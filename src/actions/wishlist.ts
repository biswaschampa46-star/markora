"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { products, recentlyViewed, wishlistItems } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

type ActionResult = { ok: boolean; message: string; requireLogin?: boolean; added?: boolean };

/** How many "recently viewed" rows are kept per buyer. */
const MAX_VIEW_HISTORY = 20;

/** Revalidates the wishlist page and the header badge that counts its items. */
function revalidateWishlist(): void {
  revalidatePath("/wishlist");
  revalidatePath("/", "layout");
}

export async function toggleWishlistAction(productId: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "পছন্দের তালিকায় যোগ করতে লগইন করুন।", requireLogin: true };

  // Only the existence check is needed - selecting the whole row pulls the
  // description, images and tags across the wire for nothing.
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) return { ok: false, message: "পণ্যটি খুঁজে পাওয়া যায়নি।" };

  const existing = await db
    .select()
    .from(wishlistItems)
    .where(and(eq(wishlistItems.userId, user.id), eq(wishlistItems.productId, productId)))
    .limit(1);

  if (existing.length > 0) {
    await db.delete(wishlistItems).where(eq(wishlistItems.id, existing[0].id));
    revalidateWishlist();
    return { ok: true, message: "পছন্দের তালিকা থেকে সরানো হয়েছে।", added: false };
  }

  await db.insert(wishlistItems).values({ userId: user.id, productId });
  revalidateWishlist();
  return { ok: true, message: "পছন্দের তালিকায় পণ্যটি যোগ করা হয়েছে।", added: true };
}

export async function removeFromWishlistAction(productId: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "আপনার সেশন শেষ হয়ে গেছে। আবার লগইন করুন।", requireLogin: true };

  await db
    .delete(wishlistItems)
    .where(and(eq(wishlistItems.userId, user.id), eq(wishlistItems.productId, productId)));

  revalidateWishlist();
  return { ok: true, message: "পছন্দের তালিকা থেকে সরানো হয়েছে।" };
}

export async function recordRecentlyViewedAction(productId: number): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  await db
    .insert(recentlyViewed)
    .values({ userId: user.id, productId })
    .onConflictDoUpdate({
      target: [recentlyViewed.userId, recentlyViewed.productId],
      set: { viewedAt: new Date() },
    });

  // Trim the tail of the history. Only the ids beyond the cap are fetched, and
  // they are removed in a single statement instead of one round-trip each.
  const stale = await db
    .select({ id: recentlyViewed.id })
    .from(recentlyViewed)
    .where(eq(recentlyViewed.userId, user.id))
    .orderBy(desc(recentlyViewed.viewedAt))
    .offset(MAX_VIEW_HISTORY);

  if (stale.length > 0) {
    await db.delete(recentlyViewed).where(
      inArray(
        recentlyViewed.id,
        stale.map((row) => row.id),
      ),
    );
  }
}
