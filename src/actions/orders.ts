"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  deliveryPayments,
  notifications,
  orderItems,
  orders,
  orderStatusHistory,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { releaseReservedStock, type StockLineItem } from "@/lib/inventory";

type ActionResult = { ok: boolean; message: string };

/** Customer cancels their own order while it is still pending (stock hold released). */
export async function cancelOrderAction(orderNumber: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "আপনার সেশন শেষ হয়ে গেছে। আবার লগইন করুন।" };

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);

  if (!order || order.userId !== user.id) {
    return { ok: false, message: "অর্ডারটি খুঁজে পাওয়া যায়নি।" };
  }
  if (order.status !== "pending" && order.status !== "pending_payment") {
    return { ok: false, message: "শুধুমাত্র অপেক্ষমাণ (pending) অর্ডার বাতিল করা যায়।" };
  }

  const items = await db
    .select({ productId: orderItems.productId, variantId: orderItems.variantId, quantity: orderItems.quantity })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  await db.transaction(async (tx) => {
    await releaseReservedStock(
      tx,
      items.map((i) => ({ productId: i.productId, variantId: i.variantId ?? null, quantity: i.quantity })),
    );

    await tx.update(orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(orders.id, order.id));

    // A cancelled pre-payment order must have its delivery pre-payment flagged
    // for refund — the money was already sent by the buyer.
    await tx
      .update(deliveryPayments)
      .set({ paymentStatus: "refunded", adminNote: "অর্ডার বাতিলের কারণে রিফান্ডের জন্য চিহ্নিত।" })
      .where(and(eq(deliveryPayments.orderId, order.id), eq(deliveryPayments.paymentStatus, "pending")));

    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      status: "cancelled",
      note: "গ্রাহক অর্ডারটি বাতিল করেছেন।",
    });

    await tx.insert(notifications).values({
      userId: user.id,
      audience: "customer",
      type: "order_status",
      title: "অর্ডার বাতিল",
      message: `আপনার অর্ডার ${order.orderNumber} বাতিল করা হয়েছে।`,
      link: `/my-orders/${order.orderNumber}`,
    });
  });

  revalidatePath("/my-orders");
  revalidatePath(`/my-orders/${order.orderNumber}`);
  revalidatePath("/", "layout");
  return { ok: true, message: "অর্ডারটি বাতিল করা হয়েছে।" };
}
