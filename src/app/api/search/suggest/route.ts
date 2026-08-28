import { NextRequest, NextResponse } from "next/server";
import { listProducts } from "@/lib/queries/catalog";
import { computePrice } from "@/lib/pricing";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

export const runtime = "nodejs"; // pg/Drizzle - never edge

/**
 * Typeahead fires on almost every keystroke, and each call is an ILIKE scan.
 * The budget is generous enough for real typing but stops the endpoint being
 * used to scrape or hammer the catalogue.
 */
const MAX_REQUESTS = 120;
const WINDOW_MS = 60 * 1000;

/** Anything longer is not a product search - and would only widen the scan. */
const MAX_QUERY_LENGTH = 64;
const SUGGESTION_COUNT = 6;

export async function GET(request: NextRequest) {
  if (rateLimit(`suggest:${getClientIp(request)}`, MAX_REQUESTS, WINDOW_MS).limited) {
    return NextResponse.json({ items: [] }, { status: 429 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim().slice(0, MAX_QUERY_LENGTH);
  if (!q) {
    return NextResponse.json({ items: [] });
  }

  const { items } = await listProducts({ q, page: 1, pageSize: SUGGESTION_COUNT, sort: "popularity" });

  return NextResponse.json({
    items: items.map((p) => {
      const priceInfo = computePrice(p);
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        thumbnail: p.thumbnail,
        price: priceInfo.price,
        originalPrice: priceInfo.originalPrice,
      };
    }),
  });
}
