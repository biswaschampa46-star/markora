import "server-only";
import { AI_CONFIG, isAiConfigured } from "./config";

/**
 * AI review moderation — one small non-streaming OpenRouter call that checks a
 * buyer's product review for disrespectful language, 18+ content, hate/threats,
 * spam and personal data. Clean reviews publish instantly without any admin
 * permission; flagged ones are held as `pending` for the admin.
 *
 * Failure policy (product decision): if the AI is unreachable / rate limited /
 * unconfigured the review is auto-published, but the local wordlist below still
 * runs first so the obvious cases never slip through unchecked.
 */

const AI_TIMEOUT_MS = 10_000;

export type ModerationVerdict = {
  decision: "approved" | "flagged";
  /** Bengali, admin-facing explanation. Null when nothing to say. */
  reason: string | null;
  source: "ai" | "wordlist" | "unavailable";
};

/** Obvious abuse / 18+ terms (bn + banglish + en). Deliberately short: this is
 *  a safety net for when the AI is down, not the primary filter. */
const BLOCKED_TERMS = [
  // Bengali
  "মাগী", "মাগি", "বেশ্যা", "বেশ্যার", "চুদ", "চোদ", "চুদা", "খানকি", "খানকী",
  "শালা", "কুত্তার বাচ্চা", "হারামি", "হারামজাদা", "বাল", "ধোন", "গুদ", "চটি",
  // Banglish / English
  "magi", "beshya", "khanki", "choda", "chuda", "chudi", "kutta", "harami",
  "fuck", "fucking", "motherfucker", "bitch", "bastard", "asshole", "cunt",
  "dick", "pussy", "porn", "porno", "sex video", "xxx", "nude", "nudes",
  "randi", "gandu", "bhosda", "bhosdi", "madarchod", "behenchod",
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    // collapse leetspeak-ish separators so "f u c k" / "f-u-c-k" still match
    .replace(/[\s._\-*|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordlistHit(comment: string): string | null {
  const normalized = normalize(comment);
  const squashed = normalized.replace(/ /g, "");
  for (const term of BLOCKED_TERMS) {
    const t = normalize(term);
    if (normalized.includes(t) || squashed.includes(t.replace(/ /g, ""))) return term;
  }
  return null;
}

const SYSTEM_PROMPT = `You are a strict content moderator for a Bangladeshi e-commerce store (Markora).
You read product reviews written in Bengali, Banglish (Bengali in Latin letters) or English.

Flag the review (ok = false) if it contains ANY of:
- disrespectful language, insults, profanity or abusive words
- sexual, adult or 18+ content or innuendo
- hate speech, harassment, threats or violence
- spam, advertising, links, or repeated meaningless text
- personal data such as phone numbers, emails or full addresses

Do NOT flag a review just because it is negative, critical or gives a low rating.
An honest complaint written in polite language must pass (ok = true).

Reply with ONLY a JSON object, no markdown, no explanation outside it:
{"ok": true} or {"ok": false, "reason": "<short reason in Bengali>"}`;

function parseVerdict(raw: string): { ok: boolean; reason: string | null } | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as { ok?: unknown; reason?: unknown };
    if (typeof obj.ok !== "boolean") return null;
    const reason = typeof obj.reason === "string" && obj.reason.trim().length > 0
      ? obj.reason.trim().slice(0, 300)
      : null;
    return { ok: obj.ok, reason };
  } catch {
    return null;
  }
}

export async function moderateReviewComment(
  comment: string | null | undefined,
): Promise<ModerationVerdict> {
  const text = (comment ?? "").trim();

  // Rating-only review — nothing to moderate, no AI call.
  if (text.length === 0) {
    return { decision: "approved", reason: null, source: "wordlist" };
  }

  // Step 1 — local wordlist. A hit is decisive; skip the AI call entirely.
  const hit = wordlistHit(text);
  if (hit) {
    return {
      decision: "flagged",
      reason: `আপত্তিকর শব্দ পাওয়া গেছে ("${hit}") — স্থানীয় ফিল্টার।`,
      source: "wordlist",
    };
  }

  if (!isAiConfigured()) {
    return {
      decision: "approved",
      reason: "AI যাচাই করা যায়নি (কনফিগার করা নেই) — স্বয়ংক্রিয়ভাবে প্রকাশিত।",
      source: "unavailable",
    };
  }

  // Step 2 — AI moderation: primary model, then fallback.
  for (const model of [AI_CONFIG.model, AI_CONFIG.fallbackModel]) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
      const res = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${AI_CONFIG.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": AI_CONFIG.siteUrl,
          "X-Title": "Markora Review Moderation",
        },
        body: JSON.stringify({
          model,
          max_tokens: 120,
          temperature: 0,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `Review:\n"""${text.slice(0, 2000)}"""` },
          ],
        }),
      }).finally(() => clearTimeout(timer));

      if (!res.ok) {
        console.error(`[review-moderation] ${model} HTTP ${res.status}`);
        continue;
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = data.choices?.[0]?.message?.content ?? "";
      const verdict = parseVerdict(raw);
      if (!verdict) {
        console.error(`[review-moderation] ${model} unparseable output: ${raw.slice(0, 200)}`);
        continue;
      }

      return verdict.ok
        ? { decision: "approved", reason: null, source: "ai" }
        : {
            decision: "flagged",
            reason: verdict.reason ?? "AI পর্যালোচনাটিতে আপত্তিকর কনটেন্ট পেয়েছে।",
            source: "ai",
          };
    } catch (err) {
      console.error(`[review-moderation] ${model} failed: ${String(err)}`);
    }
  }

  // Every model failed — fail open (wordlist already passed).
  return {
    decision: "approved",
    reason: "AI যাচাই করা যায়নি (সেবা সাময়িকভাবে অনুপলব্ধ) — স্বয়ংক্রিয়ভাবে প্রকাশিত।",
    source: "unavailable",
  };
}
