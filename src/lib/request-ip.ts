import "server-only";

/**
 * Resolves the client IP for rate-limiting keys.
 *
 * `X-Forwarded-For` is a client-settable header: the left-most entry is
 * whatever the caller claims, so keying a limiter on it lets an attacker rotate
 * identities at will and bypass the limit entirely. Only the right-most entries
 * — appended by proxies we actually control — are trustworthy.
 *
 * `TRUSTED_PROXY_HOPS` is how many proxies sit in front of this app (1 for a
 * single platform edge/load balancer, which is the default).
 */
const TRUSTED_HOPS = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? 1) || 1);

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    // Count in from the right: the entry our own outermost proxy appended.
    const candidate = hops[Math.max(0, hops.length - TRUSTED_HOPS)];
    if (candidate) return candidate;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
