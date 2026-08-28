"use server";

import { revalidatePath } from "next/cache";
import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { notifications, orderItems, orders, products, reviews } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { moderateReviewComment } from "@/lib/ai/review-moderation";
import { recomputeProductRating } from "@/lib/ratings";
import { reviewSchema } from "@/lib/validation";
import { describeUploadError, uploadProductImage } from "@/lib/supabase";

export type ReviewActionState = { error?: string; success?: string } | null;

export async function submitReviewAction(_prev: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "পর্যালোচনা লিখতে অনুগ্রহ করে লগইন করুন।" };
  }

  const parsed = reviewSchema.safeParse({
    productId: Number(formData.get("productId")),
    rating: Number(formData.get("rating")),
    comment: formData.get("comment"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়।" };
  }

  const { productId, rating, comment } = parsed.data;

  // Optional buyer photos (multiple): validated + uploaded to Supabase
  // Storage. Upload failures are user-fixable, so the reason is surfaced
  // verbatim.
  const imageUrls: string[] = [];
  const images = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  for (const image of images) {
    try {
      const uploaded = await uploadProductImage(image, "reviews");
      imageUrls.push(uploaded.url);
    } catch (error) {
      return { error: describeUploadError(error) };
    }
  }

  // Only customers who actually bought the product may review it.
  const purchase = await db
    .select({ orderId: orders.id })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.userId, user.id),
        eq(orderItems.productId, productId),
        notInArray(orders.status, ["cancelled", "failed"]),
      ),
    )
    .limit(1);

  if (purchase.length === 0) {
    return { error: "শুধুমাত্র পণ্যটি কেনা ক্রেতারাই পর্যালোচনা দিতে পারবেন।" };
  }

  const existing = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.userId, user.id)))
    .limit(1);

  if (existing.length > 0) {
    return { error: "আপনি ইতিমধ্যে এই পণ্যের জন্য পর্যালোচনা দিয়েছেন।" };
  }

  // AI moderation gate: a clean review publishes instantly (no admin
  // permission needed); a flagged one waits as `pending` for the admin.
  const verdict = await moderateReviewComment(comment);
  const approved = verdict.decision === "approved";

  await db.insert(reviews).values({
    productId,
    userId: user.id,
    orderId: purchase[0].orderId,
    rating,
    comment: comment || null,
    imageUrl: imageUrls[0] ?? null,
    imageUrls: imageUrls.length > 0 ? imageUrls : null,
    isVerifiedPurchase: true,
    status: approved ? "approved" : "pending",
    moderationSource: verdict.source,
    moderationReason: verdict.reason,
  });

  if (approved) {
    await recomputeProductRating(productId);
  }

  // Inform the admin either way — publishing does not require their approval,
  // but they should still know a review landed on this product.
  const [product] = await db
    .select({ name: products.name })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  const productName = product?.name ?? `পণ্য #${productId}`;

  await db.insert(notifications).values({
    userId: null,
    audience: "admin",
    type: "product_review",
    title: `নতুন পর্যালোচনা (${rating}★) — ${productName}`.slice(0, 160),
    message: approved
      ? `${user.name} পর্যালোচনা দিয়েছেন — AI যাচাই শেষে স্বয়ংক্রিয়ভাবে প্রকাশিত হয়েছে।`
      : `${user.name} এর পর্যালোচনা অনুমোদনের অপেক্ষায়। কারণ: ${verdict.reason ?? "আপত্তিকর কনটেন্ট।"}`.slice(0, 400),
    link: approved ? "/admin/reviews?status=approved" : "/admin/reviews?status=pending",
  });

  revalidatePath("/products/[slug]", "page");
  return approved
    ? { success: "আপনার পর্যালোচনা প্রকাশিত হয়েছে। মতামত দেওয়ার জন্য ধন্যবাদ!" }
    : { success: "আপনার পর্যালোচনা যাচাইয়ের জন্য পাঠানো হয়েছে, অনুমোদনের পর প্রকাশিত হবে।" };
}
