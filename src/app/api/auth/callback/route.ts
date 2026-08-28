import { NextResponse } from "next/server";

/**
 * GET /api/auth/callback
 *
 * Legacy OAuth entry point kept as a permanent alias. Older clients,
 * bookmarks, or dashboard-configured URLs may still target this path;
 * forward every query param (code, state, redirect, ...) to the current
 * /auth/callback page, which performs the browser-side PKCE exchange.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const dest = new URL("/auth/callback", url.origin);
  url.searchParams.forEach((value, key) => dest.searchParams.set(key, value));
  return NextResponse.redirect(dest);
}
