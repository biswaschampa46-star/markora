import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";

/**
 * Markora Verified Buyer program.
 *
 * A buyer who completes VERIFIED_BUYER_THRESHOLD orders that genuinely reach
 * "delivered" earns the Markora Verified Buyer badge. Counts are maintained
 * exclusively inside server-side order-status transactions — quantity inside
 * an order never matters (one delivered order = +1, regardless of items), and
 * cancelled / failed / refunded orders are excluded (reversed) automatically.
 *
 * The counter lives on the users table and is NEVER writable from the client:
 * the only code paths that touch it are `applySuccessfulOrder` and
 * `reverseSuccessfulOrder`, both invoked from the admin-only order workflow.
 */

/** Successfully completed (delivered) orders needed to earn the badge. */
export const VERIFIED_BUYER_THRESHOLD = 3;

/** Transaction handle passed to drizzle transaction callbacks. */
export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type BuyerVerification = {
  successfulOrderCount: number;
  isVerifiedBuyer: boolean;
  verifiedAt: Date | null;
  /** Orders still needed to earn the badge (0 when already verified). */
  remainingForVerification: number;
};

/**
 * Authoritative verification state for a buyer, read from the users table.
 * Never trust a client-supplied count — this is the only source of truth.
 */
export async function getBuyerVerification(userId: number): Promise<BuyerVerification> {
  const [row] = await db
    .select({
      successfulOrderCount: users.successfulOrderCount,
      isVerifiedBuyer: users.isVerifiedBuyer,
      verifiedAt: users.verifiedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const successfulOrderCount = Number(row?.successfulOrderCount ?? 0);
  const isVerifiedBuyer = Boolean(row?.isVerifiedBuyer);
  return {
    successfulOrderCount,
    isVerifiedBuyer,
    verifiedAt: row?.verifiedAt ?? null,
    remainingForVerification: isVerifiedBuyer ? 0 : Math.max(0, VERIFIED_BUYER_THRESHOLD - successfulOrderCount),
  };
}

/**
 * Counts one successfully completed (delivered) order for the buyer and
 * grants the Markora Verified Buyer badge the moment the threshold is
 * reached. Must run inside the same transaction as the status change so a
 * status update and its count can never diverge.
 *
 * Duplicate counting is structurally impossible: the order workflow only
 * allows a transition INTO "delivered" once per order (see ALLOWED_TRANSITIONS),
 * and this helper is only called on that exact transition.
 */
export async function applySuccessfulOrder(tx: DbTx, userId: number): Promise<void> {
  const [updated] = await tx
    .update(users)
    .set({ successfulOrderCount: sql`${users.successfulOrderCount} + 1` })
    .where(eq(users.id, userId))
    .returning({
      successfulOrderCount: users.successfulOrderCount,
      isVerifiedBuyer: users.isVerifiedBuyer,
    });

  if (!updated) return;

  if (!updated.isVerifiedBuyer && updated.successfulOrderCount >= VERIFIED_BUYER_THRESHOLD) {
    await tx
      .update(users)
      .set({ isVerifiedBuyer: true, verifiedAt: new Date() })
      .where(eq(users.id, userId));

    await tx.insert(notifications).values({
      userId,
      audience: "customer",
      type: "verified_buyer",
      title: "🎉 আপনি এখন Markora Verified Buyer!",
      message: `সফলভাবে ${VERIFIED_BUYER_THRESHOLD}টি অর্ডার সম্পন্ন হয়েছে। আপনার অ্যাকাউন্টে Verified ব্যাজ যুক্ত হয়েছে।`,
      link: "/account",
    });
  }
}

/**
 * Removes a previously counted successful order (buyer returned the product
 * or was refunded). Only called when an order leaves the "delivered" state —
 * i.e. delivered → returned / refund_requested — so it can never double-
 * subtract. If the reversal drops the buyer below the threshold, the badge
 * is revoked as well.
 */
export async function reverseSuccessfulOrder(tx: DbTx, userId: number): Promise<void> {
  const [updated] = await tx
    .update(users)
    .set({ successfulOrderCount: sql`GREATEST(${users.successfulOrderCount} - 1, 0)` })
    .where(eq(users.id, userId))
    .returning({
      successfulOrderCount: users.successfulOrderCount,
      isVerifiedBuyer: users.isVerifiedBuyer,
    });

  if (!updated) return;

  if (updated.isVerifiedBuyer && updated.successfulOrderCount < VERIFIED_BUYER_THRESHOLD) {
    await tx
      .update(users)
      .set({ isVerifiedBuyer: false, verifiedAt: null })
      .where(eq(users.id, userId));
  }
}

/** Bengali progress line shown on the account page for unverified buyers. */
export function verificationProgressMessage(remaining: number): string {
  if (remaining <= 0) return "✓ You are a Markora Verified Buyer";
  return `আর ${remaining}টি successful order complete করলেই আপনি Markora Verified Buyer হবেন।`;
}