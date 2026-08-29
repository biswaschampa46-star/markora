import "server-only";
import { db } from "@/db";
import { orderItems, orderMessages, orders, orderStatusHistory, users } from "@/db/schema";
import { and, asc, desc, eq, inArray, notInArray } from "drizzle-orm";

/** Order statuses that mean the purchase never actually happened. */
const NON_PURCHASE_STATUSES = ["cancelled", "failed"];

export async function getUserOrders(userId: number) {
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}

/**
 * Whether the user has bought this product in any live (non-cancelled,
 * non-failed) order. Used to gate product reviews to real buyers.
 */
export async function hasUserPurchased(userId: number, productId: number) {
  const rows = await db
    .select({ orderId: orders.id })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.userId, userId),
        eq(orderItems.productId, productId),
        notInArray(orders.status, NON_PURCHASE_STATUSES),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function getOrderDetail(orderNumber: string, userId?: number) {
  const conditions = userId
    ? and(eq(orders.orderNumber, orderNumber), eq(orders.userId, userId))
    : eq(orders.orderNumber, orderNumber);

  const [row] = await db
    .select({ order: orders, customerName: users.name, customerEmail: users.email })
    .from(orders)
    .innerJoin(users, eq(orders.userId, users.id))
    .where(conditions)
    .limit(1);
  if (!row) return null;
  const { order, customerName, customerEmail } = row;

  const [items, history] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    db
      .select()
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, order.id))
      .orderBy(orderStatusHistory.createdAt),
  ]);

  return { order, items, history, customerName, customerEmail };
}

// ---------------------------------------------------------------------------
// ORDER MESSAGES (one-way: admin → buyer, read-only for buyers)
// ---------------------------------------------------------------------------

export type OrderMessageRow = typeof orderMessages.$inferSelect;

/** All messages for one order, oldest first. */
export async function getOrderMessages(orderId: number): Promise<OrderMessageRow[]> {
  return db
    .select()
    .from(orderMessages)
    .where(eq(orderMessages.orderId, orderId))
    .orderBy(asc(orderMessages.createdAt));
}

/**
 * Every message across the buyer's orders, newest first, joined with the
 * order number so the inbox can group them. Read-only — no reply path.
 */
export async function getBuyerOrderMessages(userId: number) {
  return db
    .select({
      id: orderMessages.id,
      orderId: orderMessages.orderId,
      orderNumber: orders.orderNumber,
      message: orderMessages.message,
      sentByName: orderMessages.sentByName,
      isRead: orderMessages.isRead,
      createdAt: orderMessages.createdAt,
    })
    .from(orderMessages)
    .innerJoin(orders, eq(orderMessages.orderId, orders.id))
    .where(eq(orders.userId, userId))
    .orderBy(desc(orderMessages.createdAt));
}

/** Unread message count for the account page badge. */
export async function countUnreadOrderMessages(userId: number): Promise<number> {
  const rows = await db
    .select({ id: orderMessages.id })
    .from(orderMessages)
    .innerJoin(orders, eq(orderMessages.orderId, orders.id))
    .where(and(eq(orders.userId, userId), eq(orderMessages.isRead, false)));
  return rows.length;
}

/** Marks all of the buyer's order messages as read (called when inbox opens). */
export async function markAllBuyerMessagesAsRead(userId: number): Promise<void> {
  const orderRows = await db.select({ id: orders.id }).from(orders).where(eq(orders.userId, userId));
  const ids = orderRows.map((o) => o.id);
  if (ids.length === 0) return;
  await db
    .update(orderMessages)
    .set({ isRead: true })
    .where(and(eq(orderMessages.isRead, false), inArray(orderMessages.orderId, ids)));
}
