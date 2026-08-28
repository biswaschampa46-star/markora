import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCartWithDetails } from "@/lib/queries/commerce";
import { evaluateCoupon } from "@/lib/coupon";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs"; // pg/Drizzle - never edge
export const dynamic = "force-dynamic";

/**
 * Coupon codes are short and guessable, and this endpoint reports precisely why
 * a code was refused - which makes it an enumeration oracle. Budget the
 * attempts per account so the whole code space cannot be swept.
 */
const MAX_ATTEMPTS = 20;
const WINDOW_MS = 10 * 60 * 1000;

/** Longest coupon code accepted, matching the column width. */
const MAX_CODE_LENGTH = 40;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "আপনার সেশন শেষ হয়ে গেছে। আবার লগইন করুন।" }, { status: 401 });
  }

  const limit = rateLimit(`coupon:${user.id}`, MAX_ATTEMPTS, WINDOW_MS);
  if (limit.limited) {
    return NextResponse.json(
      { ok: false, message: "অনেক বেশি কুপন চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { code?: unknown };
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code || code.length > MAX_CODE_LENGTH) {
    return NextResponse.json({ ok: false, message: "কুপন কোড লিখুন।" });
  }

  const cart = await getCartWithDetails(user.id);
  if (cart.length === 0) {
    return NextResponse.json({ ok: false, message: "আপনার কার্ট খালি রয়েছে।" });
  }
  const unavailable = cart.some((i) => !i.isAvailable);
  if (unavailable) {
    return NextResponse.json({ ok: false, message: "কার্টে থাকা কিছু পণ্য বর্তমানে স্টকে নেই।" });
  }

  const evaluation = await evaluateCoupon(
    code,
    user.id,
    cart.map((i) => ({ productId: i.product.id, categoryId: i.product.categoryId, lineTotal: i.lineTotal })),
  );

  if (!evaluation.ok) {
    return NextResponse.json({ ok: false, message: evaluation.message });
  }

  return NextResponse.json({
    ok: true,
    message: "কুপনটি প্রয়োগ করা হয়েছে।",
    discount: evaluation.discount,
    freeShipping: evaluation.freeShipping,
    code: evaluation.coupon.code,
  });
}
