import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { couponUsages, coupons } from "@/db/schema";

export type CouponCartLine = {
  productId: number;
  categoryId: number | null;
  lineTotal: number;
};

export type CouponEvaluation =
  | { ok: false; message: string }
  | { ok: true; coupon: typeof coupons.$inferSelect; discount: number; freeShipping: boolean };

export async function evaluateCoupon(
  code: string,
  userId: number,
  lines: CouponCartLine[],
): Promise<CouponEvaluation> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { ok: false, message: "কুপন কোড লিখুন।" };

  const [coupon] = await db
    .select()
    .from(coupons)
    .where(sql`upper(${coupons.code}) = ${normalized}`)
    .limit(1);

  if (!coupon || !coupon.isActive) {
    return { ok: false, message: "কুপনটি সঠিক নয়।" };
  }

  const now = new Date();
  if (coupon.startDate && now < coupon.startDate) {
    return { ok: false, message: "কুপনটি এখনও কার্যকর হয়নি।" };
  }
  if (coupon.endDate && now > coupon.endDate) {
    return { ok: false, message: "কুপনটি আর কার্যকর নয়।" };
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, message: "কুপনের ব্যবহারসীমা শেষ হয়ে গেছে।" };
  }

  if (coupon.perUserLimit !== null) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(couponUsages)
      .where(and(eq(couponUsages.couponId, coupon.id), eq(couponUsages.userId, userId)));
    if (count >= coupon.perUserLimit) {
      return { ok: false, message: "আপনি ইতিমধ্যে এই কুপনটি ব্যবহার করেছেন।" };
    }
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  if (Number(coupon.minPurchase) > 0 && subtotal < Number(coupon.minPurchase)) {
    return {
      ok: false,
      message: `এই কুপন ব্যবহার করতে সর্বনিম্ন ${Number(coupon.minPurchase)} টাকার পণ্য কিনতে হবে।`,
    };
  }

  const productIds = coupon.applicableProductIds ?? [];
  const categoryIds = coupon.applicableCategoryIds ?? [];
  let eligibleLines = lines;
  if (productIds.length > 0 || categoryIds.length > 0) {
    eligibleLines = lines.filter(
      (l) => productIds.includes(l.productId) || (l.categoryId !== null && categoryIds.includes(l.categoryId)),
    );
  }
  const eligibleSubtotal = eligibleLines.reduce((sum, l) => sum + l.lineTotal, 0);

  if (eligibleSubtotal <= 0) {
    return { ok: false, message: "এই কুপনটি আপনার কার্টের পণ্যের জন্য প্রযোজ্য নয়।" };
  }

  if (coupon.type === "free_shipping") {
    return { ok: true, coupon, discount: 0, freeShipping: true };
  }

  if (coupon.type === "percentage") {
    let discount = (eligibleSubtotal * Number(coupon.value)) / 100;
    if (coupon.maxDiscount !== null) discount = Math.min(discount, Number(coupon.maxDiscount));
    return { ok: true, coupon, discount: Math.round(discount), freeShipping: false };
  }

  // fixed
  const discount = Math.min(Number(coupon.value), eligibleSubtotal);
  return { ok: true, coupon, discount: Math.round(discount), freeShipping: false };
}
