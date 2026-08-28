import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";

/**
 * Buyer trust program: the first DELIVERY_TRUST_THRESHOLD successfully
 * delivered products must pre-pay the delivery charge (no COD). Once a
 * buyer has that many delivered products, cash on delivery unlocks.
 */
export const DELIVERY_TRUST_THRESHOLD = 5;

export type BuyerTrust = {
  /** Total quantity of products across successfully delivered orders */
  deliveredProductCount: number;
  /** Products still needed to unlock COD delivery */
  remainingForCod: number;
  codEligible: boolean;
};

export async function getBuyerTrust(userId: number): Promise<BuyerTrust> {
  const [row] = await db
    .select({
      qty: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(eq(orders.userId, userId), eq(orders.status, "delivered")));

  const deliveredProductCount = Number(row?.qty ?? 0);
  return {
    deliveredProductCount,
    remainingForCod: Math.max(0, DELIVERY_TRUST_THRESHOLD - deliveredProductCount),
    codEligible: deliveredProductCount >= DELIVERY_TRUST_THRESHOLD,
  };
}

/** Bengali message shown/returned when COD is not yet unlocked. */
export function codLockedMessage(remainingForCod: number): string {
  return `অনুগ্রহ করে ডেলিভারি চার্জ আগে অগ্রিম (pre-pay) দিন। সফলভাবে ${DELIVERY_TRUST_THRESHOLD} টি পণ্য কেনার পর ক্যাশ অন ডেলিভারি (COD) চালু হবে। এখন ${remainingForCod} টি পণ্য বাকি আছে।`;
}