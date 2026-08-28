import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Singleton Supabase browser client.
 *
 * PKCE flow stores the code verifier in localStorage keyed by the project ref.
 * Creating multiple client instances is safe, but a singleton avoids redundant
 * initialisation and guarantees the same client handles both signInWithOAuth
 * (on the login page) and exchangeCodeForSession (on the callback page).
 */
let _client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase browser env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required in .env.local",
    );
  }

  _client = createClient(url, key, {
    auth: {
      flowType: "pkce",
      autoRefreshToken: true,
      persistSession: true,
      // Keep detectSessionInUrl OFF so the /auth/callback page explicitly
      // controls when the PKCE code exchange happens. This avoids race
      // conditions where the library exchanges the code before the page
      // has a chance to read query params.
      detectSessionInUrl: false,
    },
  });

  return _client;
}
