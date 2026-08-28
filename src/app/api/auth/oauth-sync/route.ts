import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

export const runtime = "nodejs"; // pg/Drizzle - never edge
export const dynamic = "force-dynamic";

/**
 * Emails auto-promoted to admin on OAuth login.
 *
 * Read from `ADMIN_EMAILS` (comma-separated) so adding an administrator is a
 * config change rather than a code change, with the founding account as the
 * fallback. Promotion additionally requires a verified email - see `POST`.
 */
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "biswaschampa46@gmail.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.has(email.toLowerCase());
}

const BodySchema = z.object({ accessToken: z.string().min(1).max(4096) });

/** Token-verification attempts allowed per IP per window. */
const MAX_ATTEMPTS = 20;
const WINDOW_MS = 10 * 60 * 1000;

/**
 * POST /api/auth/oauth-sync
 *
 * Called by the /auth/callback client page after the browser-side PKCE
 * exchange succeeds. The access token is verified against Supabase so a
 * caller cannot claim an arbitrary identity, then we mirror the verified
 * user into the local DB and issue the app's own session cookie.
 */
export async function POST(request: Request) {
  if (rateLimit(`oauth-sync:${getClientIp(request)}`, MAX_ATTEMPTS, WINDOW_MS).limited) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase env vars for oauth-sync");
    return NextResponse.json({ error: "server_config" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  let authUser: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"];
  try {
    const { data, error } = await supabase.auth.getUser(parsed.data.accessToken);
    if (error || !data.user || !data.user.email) {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }
    authUser = data.user;
  } catch (err) {
    // Network failure talking to Supabase - must not be reported as an invalid
    // token, which would send the user into a pointless re-login loop.
    console.error("[oauth-sync] token verification failed:", err);
    return NextResponse.json({ error: "verification_unavailable" }, { status: 503 });
  }

  const email = authUser.email!;
  const metadata = authUser.user_metadata ?? {};

  // Admin promotion is keyed on the email address, so an unverified address is
  // an impersonation vector: anyone able to create a Supabase identity carrying
  // an admin email would otherwise be handed the admin role. OAuth providers
  // verify the address; email-password identities may not have.
  const emailVerified = Boolean(
    authUser.email_confirmed_at || metadata.email_verified === true,
  );

  const pickString = (...values: unknown[]): string | null => {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
  };

  const localUser = await upsertLocalUser(
    email,
    pickString(metadata.full_name, metadata.name) ?? email.split("@")[0],
    pickString(metadata.avatar_url, metadata.picture),
    emailVerified,
  );

  // A blocked account must not be able to walk back in through Google.
  if (localUser.status !== "active") {
    return NextResponse.json({ error: "account_blocked" }, { status: 403 });
  }

  await createSession(localUser.id);

  return NextResponse.json({
    redirectTo: localUser.role === "admin" ? "/admin" : "/account",
  });
}

type LocalUser = { id: number; email: string; role: string; status: string };

/**
 * Finds or creates the local user row mirroring a verified Supabase identity.
 *
 * `emailVerified` gates admin promotion only - an unverified identity still
 * gets an ordinary customer account. An existing admin is never demoted here,
 * so revoking access stays an explicit administrative operation.
 */
async function upsertLocalUser(
  email: string,
  name: string,
  avatar: string | null,
  emailVerified: boolean,
): Promise<LocalUser> {
  const normalizedEmail = email.toLowerCase();
  const shouldPromote = emailVerified && isAdminEmail(normalizedEmail);

  const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);

  if (existing) {
    const role = shouldPromote ? "admin" : existing.role;
    const nextName = name || existing.name;
    const nextAvatar = avatar || existing.avatar;

    // Skip the write entirely when nothing actually changed.
    if (role !== existing.role || nextName !== existing.name || nextAvatar !== existing.avatar) {
      await db
        .update(users)
        .set({ name: nextName, avatar: nextAvatar, role })
        .where(eq(users.id, existing.id));
    }
    return { id: existing.id, email: normalizedEmail, role, status: existing.status };
  }

  // OAuth-only account: store an unguessable hash so the password login path
  // can never match, rather than leaving the column null.
  const passwordHash = await hashPassword(randomUUID() + randomUUID());
  const role = shouldPromote ? "admin" : "customer";

  const [created] = await db
    .insert(users)
    .values({
      name: name || normalizedEmail.split("@")[0],
      email: normalizedEmail,
      phone: null,
      passwordHash,
      role,
      status: "active",
      avatar,
    })
    .returning({ id: users.id, status: users.status });

  return { id: created.id, email: normalizedEmail, role, status: created.status };
}
