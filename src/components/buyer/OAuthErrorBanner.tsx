"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { XCircle, X } from "lucide-react";

/**
 * The query string as it was on first load, captured once.
 *
 * The banner rewrites the URL to drop the error params, so reading
 * `window.location.search` on every render would return a value that changes
 * without any subscription firing. Freezing it keeps the snapshot stable.
 */
let initialSearch: string | null = null;
function readInitialSearch(): string {
  initialSearch ??= typeof window === "undefined" ? "" : window.location.search;
  return initialSearch;
}

/** No external source to subscribe to - the snapshot never changes. */
const noopSubscribe = () => () => {};

const FRIENDLY_BY_CODE: Record<string, string> = {
  bad_oauth_state:
    "লগইন সেশনের মেয়াদ শেষ হয়ে গেছে (bad_oauth_state)। অনুগ্রহ করে আবার Google দিয়ে লগইন করুন।",
  access_denied: "আপনি Google লগইন বাতিল করেছেন।",
};

const ERROR_PARAMS = ["error", "error_code", "error_description", "state"] as const;

/** Builds the banner text, or null when the URL carries no OAuth error. */
function describeOAuthError(search: string): string | null {
  const params = new URLSearchParams(search);
  const error = params.get("error_description") || params.get("error");
  if (!error) return null;

  const friendly =
    FRIENDLY_BY_CODE[params.get("error_code") ?? ""] ??
    "গুগল লগইন সম্পন্ন হয়নি। আবার চেষ্টা করুন।";

  // The provider's raw reason is appended for support/debugging; truncated so a
  // long upstream message cannot blow out the layout.
  return `${friendly} (${error.slice(0, 200)})`;
}

/**
 * Catches OAuth errors that Supabase appends to the Site URL when the callback
 * flow fails (e.g. ?error=invalid_request&error_description=...). Shows a clear
 * message instead of letting the user land silently on the homepage wondering
 * why login didn't work.
 */
export function OAuthErrorBanner() {
  // Derived during render from a frozen snapshot: no setState-in-effect, and SSR
  // sees an empty search string so the first client paint matches.
  const search = useSyncExternalStore(noopSubscribe, readInitialSearch, () => "");
  const message = describeOAuthError(search);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!message) return;
    // Clean the URL so a refresh doesn't re-show the banner.
    const url = new URL(window.location.href);
    for (const key of ERROR_PARAMS) url.searchParams.delete(key);
    window.history.replaceState({}, "", url.toString());
  }, [message]);

  if (!message || dismissed) return null;

  return (
    <div className="mx-auto mt-4 flex max-w-7xl items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 sm:px-6">
      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
      <div className="flex-1 text-sm">
        <p className="font-medium text-red-800">{message}</p>
        <Link href="/login" className="mt-1 inline-block font-medium text-teal-700 hover:underline">
          আবার লগইন করুন →
        </Link>
      </div>
      <button
        type="button"
        aria-label="বন্ধ করুন"
        onClick={() => setDismissed(true)}
        className="shrink-0 text-red-400 hover:text-red-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
