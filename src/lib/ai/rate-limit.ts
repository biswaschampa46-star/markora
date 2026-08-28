import "server-only";
import { AI_CONFIG } from "./config";
import { rateLimit } from "@/lib/rate-limit";

/**
 * AI-assistant rate limiting. Thin wrapper kept for call-site compatibility;
 * the window logic and memory bounds live in `@/lib/rate-limit`.
 */

const WINDOW_MS = 60 * 60 * 1000; // 1 hour

export { getClientIp } from "@/lib/request-ip";

export function isRateLimited(ip: string, limitPerHour = AI_CONFIG.rateLimitPerHour): boolean {
  return rateLimit(`ai:${ip}`, limitPerHour, WINDOW_MS).limited;
}
