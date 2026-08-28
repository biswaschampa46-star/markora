import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, reviews } from "@/db/schema";

/**
 * Recomputes avg_rating / review_count for one product from its approved
 * reviews. Shared by the buyer review flow (instant publish) and admin
 * moderation so both paths keep the denormalised columns in sync.
 */
export async function recomputeProductRating(productId: number) {
  const [agg] = await db
    .select({
      avg: sql<string>`COALESCE(ROUND(AVG(${reviews.rating})::numeric, 1), '0')`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.status, "approved")));

  await db
    .update(products)
    .set({ avgRating: agg?.avg ?? "0", reviewCount: agg?.count ?? 0 })
    .where(eq(products.id, productId));
}
