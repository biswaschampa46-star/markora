"use server";

/**
 * Delivery pre-payment verification — ADMIN ONLY.
 *
 * SECURITY CONTRACT
 * -----------------
 * These actions are the ONLY place a delivery payment can move from
 * "pending" to "verified" (or be rejected/refunded):
 *
 *   1. When a gateway (e.g. bKash Tokenized Checkout) is configured, the
 *      transaction ID is checked against the official gateway API and the
 *      payment is only marked verified if the gateway confirms it.
 *   2. Without a gateway integration, an authorized admin cross-checks the
 *      transaction ID in the bKash/Nagad merchant app and verifies manually.
 *
 * The buyer-facing frontend can NEVER verify its own payment.
 */

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { deliveryPayments, notifications, orderStatusHistory, orders } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { verifyTransactionWithGateway, type PaymentGatewayMethod } from "@/lib/payments/gateway";

type ActionResult = { success: true; message: string } | { success: false; message: string };

async function loadPayment(paymentId: number) {
  const [payment] = await db
    .select({
      id: deliveryPayments.id,
      userId: deliveryPayments.userId,
      orderId: deliveryPayments.orderId,
      paymentMethod: deliveryPayments.paymentMethod,
      transactionId: deliveryPayments.transactionId,
      paymentAmount: deliveryPayments.paymentAmount,
      paymentStatus: deliveryPayments.paymentStatus,
      orderNumber: orders.orderNumber,
    })
    .from(deliveryPayments)
    .innerJoin(orders, eq(orders.id, deliveryPayments.orderId))
    .where(eq(deliveryPayments.id, paymentId))
    .limit(1);
  return payment ?? null;
}

/**
 * Verifies a pending delivery payment. When the gateway API is configured the
 * transaction ID is checked with the gateway first; otherwise an explicit
 * manual confirmation by the admin (who has cross-checked the merchant app)
 * marks it verified.
 */
export async function verifyDeliveryPaymentAction(paymentId: number): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, message: "শুধুমাত্র অ্যাডমিন এই কাজটি করতে পারবেন।" };

  const payment = await loadPayment(paymentId);
  if (!payment) {
    return { success: false, message: "পেমেন্ট রেকর্ডটি খুঁজে পাওয়া যায়নি।" };
  }
  if (payment.paymentStatus !== "pending") {
    return { success: false, message: "শুধুমাত্র পেন্ডিং পেমেন্ট যাচাই করা যায়।" };
  }
  if (payment.paymentMethod === "cod") {
    return { success: false, message: "COD অর্ডারের ডেলিভারি প্রি-পেমেন্ট হয় না।" };
  }

  const gateway = await verifyTransactionWithGateway(
    payment.paymentMethod as PaymentGatewayMethod,
    payment.transactionId,
    Number(payment.paymentAmount),
  );

  if (gateway.available && !gateway.verified) {
    // The gateway is configured and refused — do NOT mark as verified.
    await db
      .update(deliveryPayments)
      .set({
        paymentStatus: "failed",
        adminNote: `Auto-verification rejected: ${gateway.message}`,
        verifiedBy: admin.id,
        verifiedAt: new Date(),
      })
      .where(eq(deliveryPayments.id, paymentId));
    revalidatePath("/admin/delivery-payments");
    return { success: false, message: gateway.message };
  }

  const adminNote = gateway.available
    ? `Auto-verified via ${payment.paymentMethod} gateway API by admin #${admin.id}.`
    : `Manually verified by admin #${admin.id} (no gateway API configured).`;

  await db.transaction(async (tx) => {
    await tx
      .update(deliveryPayments)
      .set({
        paymentStatus: "verified",
        adminNote,
        verifiedBy: admin.id,
        verifiedAt: new Date(),
      })
      .where(eq(deliveryPayments.id, paymentId));

    // The pre-payment cleared — the order moves from pending_payment to the
    // normal processing pipeline. This transition happens server-side only.
    await tx
      .update(orders)
      .set({ status: "pending" })
      .where(and(eq(orders.id, payment.orderId), eq(orders.status, "pending_payment")));

    await tx.insert(orderStatusHistory).values({
      orderId: payment.orderId,
      status: "pending",
      note: `ডেলিভারি চার্জ প্রি-পেমেন্ট যাচাই সম্পন্ন হয়েছে (TxnID: ${payment.transactionId})।`,
    });

    await tx.insert(notifications).values({
      userId: payment.userId,
      title: "ডেলিভারি প্রি-পেমেন্ট নিশ্চিত হয়েছে",
      message: `আপনার অর্ডার ${payment.orderNumber} এর ডেলিভারি চার্জ প্রি-পেমেন্ট যাচাই হয়েছে। অর্ডার প্রসেসিং শুরু হয়েছে।`,
      type: "order",
      link: `/my-orders/${payment.orderNumber}`,
    });
  });

  revalidatePath("/admin/delivery-payments");
  revalidatePath("/admin/orders");
  return { success: true, message: "পেমেন্ট যাচাই সম্পন্ন হয়েছে এবং অর্ডার প্রসেসিংয়ে পাঠানো হয়েছে।" };
}

/** Marks a pending delivery payment as failed (e.g. TxnID not found in the merchant app). */
export async function rejectDeliveryPaymentAction(paymentId: number, note: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, message: "শুধুমাত্র অ্যাডমিন এই কাজটি করতে পারবেন।" };

  const payment = await loadPayment(paymentId);
  if (!payment) {
    return { success: false, message: "পেমেন্ট রেকর্ডটি খুঁজে পাওয়া যায়নি।" };
  }
  if (payment.paymentStatus !== "pending") {
    return { success: false, message: "শুধুমাত্র পেন্ডিং পেমেন্ট বাতিল করা যায়।" };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(deliveryPayments)
      .set({
        paymentStatus: "failed",
        adminNote: note ? `Rejected by admin #${admin.id}: ${note}` : `Rejected by admin #${admin.id}.`,
        verifiedBy: admin.id,
        verifiedAt: new Date(),
      })
      .where(eq(deliveryPayments.id, paymentId));

    await tx.insert(notifications).values({
      userId: payment.userId,
      title: "ডেলিভারি প্রি-পেমেন্ট যাচাই ব্যর্থ হয়েছে",
      message: `আপনার অর্ডার ${payment.orderNumber} এর ডেলিভারি চার্জ প্রি-পেমেন্ট যাচাই করা যায়নি। সঠিক Transaction ID দিয়ে আবার চেষ্টা করুন বা সাপোর্টে যোগাযোগ করুন।`,
      type: "order",
      link: `/my-orders/${payment.orderNumber}`,
    });
  });

  revalidatePath("/admin/delivery-payments");
  return { success: true, message: "পেমেন্ট বাতিল করা হয়েছে এবং ক্রেতাকে জানানো হয়েছে।" };
}

/** Refunds a verified payment (e.g. order could not be fulfilled). */
export async function refundDeliveryPaymentAction(paymentId: number, note: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, message: "শুধুমাত্র অ্যাডমিন এই কাজটি করতে পারবেন।" };

  const payment = await loadPayment(paymentId);
  if (!payment) {
    return { success: false, message: "পেমেন্ট রেকর্ডটি খুঁজে পাওয়া যায়নি।" };
  }
  if (payment.paymentStatus !== "verified") {
    return { success: false, message: "শুধুমাত্র যাচাইকৃত পেমেন্ট রিফান্ড করা যায়।" };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(deliveryPayments)
      .set({
        paymentStatus: "refunded",
        adminNote: note ? `Refunded by admin #${admin.id}: ${note}` : `Refunded by admin #${admin.id}.`,
      })
      .where(eq(deliveryPayments.id, paymentId));

    await tx.insert(notifications).values({
      userId: payment.userId,
      title: "ডেলিভারি প্রি-পেমেন্ট রিফান্ড করা হয়েছে",
      message: `আপনার অর্ডার ${payment.orderNumber} এর ডেলিভারি চার্জ রিফান্ড করা হয়েছে। টাকা আপনার ${payment.paymentMethod.toUpperCase()} অ্যাকাউন্টে ফেরত যাবে।`,
      type: "order",
      link: `/my-orders/${payment.orderNumber}`,
    });
  });

  revalidatePath("/admin/delivery-payments");
  return { success: true, message: "পেমেন্ট রিফান্ড হিসেবে চিহ্নিত করা হয়েছে।" };
}

/** Form-friendly wrappers so <form action={...}> works directly on server pages. */
export async function verifyDeliveryPaymentFormAction(formData: FormData): Promise<void> {
  const paymentId = Number(formData.get("paymentId"));
  if (paymentId) await verifyDeliveryPaymentAction(paymentId);
}

export async function rejectDeliveryPaymentFormAction(formData: FormData): Promise<void> {
  const paymentId = Number(formData.get("paymentId"));
  const note = String(formData.get("note") || "").trim();
  if (paymentId) await rejectDeliveryPaymentAction(paymentId, note);
}

export async function refundDeliveryPaymentFormAction(formData: FormData): Promise<void> {
  const paymentId = Number(formData.get("paymentId"));
  const note = String(formData.get("note") || "").trim();
  if (paymentId) await refundDeliveryPaymentAction(paymentId, note);
}
