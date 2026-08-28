import "server-only";

/**
 * Process-local sliding-window rate limiter.
 *
 * Deliberately dependency-free so it works on any host. The window lives in
 * the instance's memory, so limits are per-instance and reset on cold start —
 * good enough to blunt brute-force and scraping, NOT a global guarantee. Move
 * to a shared store (Redis/Upstash) before running multiple instances behind a
 * load balancer.
 */

type Bucket = { hits: number[]; expiresAt: number };

const buckets = new Map<string, Bucket>();

/** Hard cap on tracked keys so a hostile key-space cannot exhaust memory. */
const MAX_KEYS = 10_000;

export type RateLimitResult = {
  /** True when the caller is over budget and the request should be rejected. */
  limited: boolean;
  /** Requests still available in the current window. */
  remaining: number;
  /** Seconds until the window frees up — suitable for a `Retry-After` header. */
  retryAfterSeconds: number;
};

/**
 * Records a hit for `key` and reports whether it exceeded `limit` within
 * `windowMs`. A rejected call does NOT consume budget, so a client that keeps
 * hammering cannot extend its own lockout indefinitely.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  if (buckets.size > MAX_KEYS) pruneExpired(now);

  const existing = buckets.get(key);
  const hits = (existing?.hits ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    buckets.set(key, { hits, expiresAt: now + windowMs });
    const oldest = hits[0] ?? now;
    return {
      limited: true,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }

  hits.push(now);
  buckets.set(key, { hits, expiresAt: now + windowMs });
  return { limited: false, remaining: limit - hits.length, retryAfterSeconds: 0 };
}

/** Clears a key's history — call after a successful login so a valid user is not penalised. */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

function pruneExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.expiresAt <= now) buckets.delete(key);
  }
  // Still oversized (all buckets live): drop the oldest half rather than grow unbounded.
  if (buckets.size > MAX_KEYS) {
    const keys = [...buckets.keys()].slice(0, Math.floor(buckets.size / 2));
    for (const key of keys) buckets.delete(key);
  }
}
