import { NextResponse } from "next/server";
import { z } from "zod";
import { divisionOf, matchDistrict, matchDivision } from "@/lib/bd-locations";
import { getClientIp, isRateLimited } from "@/lib/ai/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/geo/reverse
 *
 * Reverse geocodes { lat, lng } for the checkout "আপনার এলাকা শেয়ার করুন"
 * button. Proxies Nominatim (OpenStreetMap) server-side — their policy
 * requires a custom User-Agent and ~1 req/s, so calls are throttled and
 * grid-cell cached here — then maps the result onto the canonical Bengali
 * division/district strings the app uses everywhere else.
 */

const BodySchema = z.object({
  lat: z.number().min(20.5).max(26.8),
  lng: z.number().min(87.9).max(92.8),
});

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/reverse";

type NominatimAddress = {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state_district?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
};

type NominatimResponse = { address?: NominatimAddress; display_name?: string };

type GeoResult = {
  ok: true;
  division: string | null;
  district: string | null;
  upazila: string | null;
  addressLine: string;
};

// Grid-cell cache (~110m cells): Nominatim's free tier allows ~1 req/s, and
// the same doorstep should always resolve to the same address.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const responseCache = new Map<string, { at: number; value: GeoResult | { error: string } }>();

// Serialize upstream calls so we never exceed Nominatim's 1 req/s policy.
let upstreamChain: Promise<void> = Promise.resolve();
function throttleUpstream<T>(task: () => Promise<T>): Promise<T> {
  const run = upstreamChain.then(task);
  upstreamChain = run.then(
    () => new Promise((resolve) => setTimeout(resolve, 1100)),
    () => new Promise((resolve) => setTimeout(resolve, 1100)),
  );
  return run;
}

function cacheGet(key: string) {
  const hit = responseCache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    responseCache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key: string, value: GeoResult | { error: string }) {
  if (responseCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = responseCache.keys().next().value;
    if (oldest !== undefined) responseCache.delete(oldest);
  }
  responseCache.set(key, { at: Date.now(), value });
}

function firstPresent(...values: (string | undefined)[]): string | null {
  for (const value of values) {
    if (value && value.trim()) return value.trim();
  }
  return null;
}

function stripUpazilaSuffix(name: string): string {
  return name
    .replace(/\s*(upazila|upazilla|thana|উপজেলা|থানা)\s*$/i, "")
    .trim();
}

function buildUpazila(addr: NominatimAddress): string | null {
  const raw = firstPresent(addr.county, addr.city_district, addr.suburb);
  if (!raw) return null;
  const cleaned = stripUpazilaSuffix(raw);
  return cleaned.length > 0 && cleaned.length <= 120 ? cleaned : null;
}

function buildAddressLine(addr: NominatimAddress, displayName: string | undefined): string {
  const parts = [
    addr.house_number,
    addr.road,
    firstPresent(addr.neighbourhood, addr.suburb, addr.quarter),
    firstPresent(addr.city, addr.town, addr.village, addr.municipality),
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(", ");

  if (parts.length >= 5) return parts.slice(0, 300);
  return (displayName ?? "").split(",").slice(0, 3).join(",").trim().slice(0, 300);
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (isRateLimited(ip, 30)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_coords" }, { status: 400 });
  }

  const { lat, lng } = parsed.data;
  const cacheKey = `${lat.toFixed(3)}:${lng.toFixed(3)}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    if ("error" in cached) {
      return NextResponse.json({ error: cached.error }, { status: cached.error === "outside_bd" ? 422 : 502 });
    }
    return NextResponse.json(cached);
  }

  let data: NominatimResponse;
  try {
    const res = await throttleUpstream(() =>
      fetch(`${NOMINATIM_BASE}?${new URLSearchParams({
        format: "jsonv2",
        lat: String(lat),
        lon: String(lng),
        zoom: "18",
        addressdetails: "1",
        "accept-language": "bn,en",
      })}`, {
        headers: {
          "User-Agent": process.env.GEO_USER_AGENT ?? "Markora/1.0 (checkout address autofill)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      }),
    );
    if (!res.ok) {
      cacheSet(cacheKey, { error: "upstream_error" });
      return NextResponse.json({ error: "upstream_error" }, { status: 502 });
    }
    data = (await res.json()) as NominatimResponse;
  } catch {
    cacheSet(cacheKey, { error: "upstream_error" });
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }

  const addr = data.address ?? {};
  if ((addr.country_code ?? "").toLowerCase() !== "bd") {
    cacheSet(cacheKey, { error: "outside_bd" });
    return NextResponse.json({ error: "outside_bd" }, { status: 422 });
  }

  // District first — the district's own list is authoritative for its
  // division (avoids stale state-level data, e.g. the Mymensingh split).
  const district =
    matchDistrict(addr.state_district) ??
    matchDistrict(addr.county) ??
    matchDistrict(addr.city_district) ??
    matchDistrict(addr.city) ??
    matchDistrict(addr.town) ??
    matchDistrict(addr.village);
  const division = (district && divisionOf(district)) || matchDivision(addr.state);

  const result: GeoResult = {
    ok: true,
    division,
    district,
    upazila: buildUpazila(addr),
    addressLine: buildAddressLine(addr, data.display_name),
  };
  cacheSet(cacheKey, result);
  return NextResponse.json(result);
}
