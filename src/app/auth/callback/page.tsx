"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, XCircle } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * Accepts only same-origin absolute paths. `//host` and `/\host` are
 * protocol-relative and would let a crafted callback URL bounce the freshly
 * logged-in user to another origin.
 */
function safeDestination(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  return raw;
}

/** Error codes returned by /api/auth/oauth-sync, mapped to buyer-facing copy. */
const SYNC_ERROR_MESSAGES: Record<string, string> = {
  account_blocked: "আপনার অ্যাকাউন্টটি ব্লক করা হয়েছে। সহায়তার জন্য যোগাযোগ করুন।",
  rate_limited: "অনেক বেশি চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।",
  invalid_token: "লগইন সেশনটি আর বৈধ নয়। আবার লগইন করুন।",
  verification_unavailable: "লগইন সার্ভারে সংযোগ করা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।",
  server_config: "সার্ভার কনফিগারেশন সমস্যা। অনুগ্রহ করে সহায়তার জন্য যোগাযোগ করুন।",
};

/**
 * /auth/callback — handles the PKCE code exchange after Supabase OAuth.
 *
 * Flow:  Google → Supabase → this page (?code=...&redirect=...)
 *        1. exchangeCodeForSession(code)  → stores Supabase session in localStorage
 *        2. POST /api/auth/oauth-sync     → creates local bd_session cookie
 *        3. window.location.replace(dest) → lands on /account or /admin
 */
export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  const syncAndRedirect = useCallback(
    async (accessToken: string, redirectParam: string | null) => {
      const res = await fetch("/api/auth/oauth-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        console.error("OAuth session sync failed:", res.status, body);
        throw new Error(
          (body.error && SYNC_ERROR_MESSAGES[body.error]) ||
            "লগইন সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।",
        );
      }

      const payload = (await res.json()) as { redirectTo?: string };
      const dest =
        safeDestination(redirectParam) ||
        (payload.redirectTo && payload.redirectTo.startsWith("/")
          ? payload.redirectTo
          : "/account");

      window.location.replace(dest);
    },
    [],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError =
      params.get("error_description") || params.get("error");
    const code = params.get("code");
    const redirectParam = params.get("redirect");

    async function completeLogin() {
      /* ---- Supabase-level error returned in the URL ---- */
      if (oauthError) {
        console.error("OAuth provider error:", oauthError);
        setError("গুগল লগইন ব্যর্থ হয়েছে।");
        setDetail(oauthError);
        return;
      }

      /* ---- No authorization code ---- */
      if (!code) {
        console.error(
          "No code in callback URL. Query string:",
          window.location.search || "(empty)",
        );
        setError("অথেনটিকেশন কোড পাওয়া যায়নি।");
        setDetail(
          "Supabase Dashboard → Authentication → URL Configuration তে " +
            '"Redirect URLs" লিস্টে http://localhost:3000/auth/callback যোগ করুন।',
        );
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();

        /* Step 1: PKCE code → Supabase session (stored in localStorage) */
        const { data, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError || !data.session) {
          console.error("Code exchange failed:", exchangeError);
          setError("লগইন সম্পন্ন করা যায়নি।");
          setDetail(
            exchangeError?.message ||
              "Supabase সাথে সেশন তৈরি করা যায়নি। আবার চেষ্টা করুন।",
          );
          return;
        }

        /* Step 2: Sync with local application session */
        await syncAndRedirect(data.session.access_token, redirectParam);
      } catch (err) {
        console.error("Unexpected callback failure:", err);
        setError("অপ্রত্যাশিত সমস্যা হয়েছে।");
        setDetail(err instanceof Error ? err.message : String(err));
      }
    }

    completeLogin();
  }, [syncAndRedirect]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      {error ? (
        <>
          <XCircle className="h-10 w-10 text-red-500" />
          <h1 className="text-lg font-bold text-slate-900">লগইন ব্যর্থ হয়েছে</h1>
          <p className="text-sm text-slate-500">{error}</p>
          {detail && (
            <p className="max-w-xs break-words rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              {detail}
            </p>
          )}
          <Link
            href="/login"
            className="mt-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-teal-800"
          >
            আবার চেষ্টা করুন
          </Link>
        </>
      ) : (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
          <p className="text-sm text-slate-500">লগইন সম্পন্ন হচ্ছে...</p>
        </>
      )}
    </div>
  );
}
