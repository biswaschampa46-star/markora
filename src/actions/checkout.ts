"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  addresses,
  cartItems,
  coupons,
  couponUsages,
  deliveryPayments,
  flashSaleItems,
  flashSales,
  notifications,
  orderItems,
  orderStatusHistory,
  orders,
  productVariants,
  products,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getStoreSettings } from "@/lib/settings";
import { getCartWithDetails } from "@/lib/queries/commerce";
import { calculateShippingFee } from "@/lib/delivery";
import { evaluateCoupon } from "@/lib/coupon";
import { generateOrderNumber } from "@/lib/order-number";
import { reserveStockForOrder } from "@/lib/inventory";
import { addressSchema } from "@/lib/validation";
import { getBuyerTrust, codLockedMessage } from "@/lib/trust";
import { getBuyerVerification } from "@/lib/verified-buyer";
import { availableStock } from "@/lib/pricing";
import { PAYMENT_METHOD_LABELS } from "@/lib/status";
import { sendOrderConfirmationEmail, type EmailOrderPayload } from "@/lib/email";

export type CheckoutState = { error?: string } | null;

/**
 * Sentinel prefix used to carry a product name out of the transaction: the
 * rollback has to happen via a throw, but the message still needs to reach the
 * buyer as ordinary form state.
 */
const STOCK_ERROR_PREFIX = "STOCK:";

/** Window in which an identical repeat submission is treated as a double-click. */
const DUPLICATE_WINDOW_MS = 20_000;

export async function placeOrderAction(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/checkout");
  if (user.status !== "active") {
    return { error: "আপনার অ্যাকাউন্টটি সাময়িকভাবে ব্লক করা হয়েছে।" };
  }

  const settings = await getStoreSettings();
  const paymentMethod = String(formData.get("paymentMethod") || "");
  const transactionId = String(formData.get("transactionId") || "").trim();
  const couponCode = String(formData.get("couponCode") || "").trim();
  const customerNote = String(formData.get("customerNote") || "").trim();
  const addressIdRaw = formData.get("addressId");

  const paymentEnabledMap: Record<string, boolean> = {
    cod: settings?.codEnabled ?? true,
    bkash: settings?.bkashEnabled ?? false,
    nagad: settings?.nagadEnabled ?? false,
    rocket: settings?.rocketEnabled ?? false,
  };

  if (!["cod", "bkash", "nagad", "rocket"].includes(paymentMethod) || !paymentEnabledMap[paymentMethod]) {
    return { error: "এই পেমেন্ট পদ্ধতিটি বর্তমানে উপলভ্য নয়।" };
  }

  if (paymentMethod !== "cod" && !transactionId) {
    return { error: "অনুগ্রহ করে পেমেন্ট করার পর লেনদেন আইডি (Transaction ID) লিখুন।" };
  }

  // Server-side verification check — the client's claim is never trusted.
  const verification = await getBuyerVerification(user.id);
  const requiresDeliveryPrepay = !verification.isVerifiedBuyer;

  // COD is only unlocked after the buyer has received the first N products
  // successfully; until then the delivery charge must be pre-paid. Verified
  // buyers are exempt — COD stays open for them at all times.
  if (paymentMethod === "cod" && requiresDeliveryPrepay) {
    const trust = await getBuyerTrust(user.id);
    if (!trust.codEligible) {
      return { error: codLockedMessage(trust.remainingForCod) };
    }
  }

  // Duplicate transaction protection (application level). The unique index on
  // delivery_payments.transaction_id is the database-level final guard.
  if (requiresDeliveryPrepay && transactionId) {
    const [dup] = await db
      .select({ id: deliveryPayments.id })
      .from(deliveryPayments)
      .where(eq(deliveryPayments.transactionId, transactionId))
      .limit(1);
    if (dup) {
      return {
        error: "এই Transaction ID ইতিমধ্যে ব্যবহৃত হয়েছে। প্রতারণামূলক লেনদেন গ্রহণ করা হয় না — সঠিক Transaction ID দিন।",
      };
    }
  }

  // Resolve shipping address
  let shippingAddress: {
    recipientName: string;
    phone: string;
    division: string;
    district: string;
    upazila: string | null;
    addressLine: string;
  } | null = null;

  if (addressIdRaw && Number(addressIdRaw) > 0) {
    const [addr] = await db
      .select()
      .from(addresses)
      .where(and(eq(addresses.id, Number(addressIdRaw)), eq(addresses.userId, user.id)))
      .limit(1);
    if (!addr) return { error: "নির্বাচিত ঠিকানাটি খুঁজে পাওয়া যায়নি।" };
    shippingAddress = addr;
  } else {
    const parsed = addressSchema.safeParse({
      label: formData.get("label") || "বাসা",
      recipientName: formData.get("recipientName"),
      phone: formData.get("phone"),
      division: formData.get("division"),
      district: formData.get("district"),
      upazila: formData.get("upazila"),
      addressLine: formData.get("addressLine"),
      isDefault: formData.get("isDefault") === "on",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "ঠিকানার তথ্য সঠিক নয়।" };
    }
    shippingAddress = { ...parsed.data, upazila: parsed.data.upazila ?? null };

    if (formData.get("saveAddress") === "on") {
      if (parsed.data.isDefault) {
        await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, user.id));
      }
      await db.insert(addresses).values({ ...parsed.data, userId: user.id });
    }
  }

  if (!shippingAddress) return { error: "ঠিকানা প্রদান করুন।" };

  const cartWithDetails = await getCartWithDetails(user.id);
  if (cartWithDetails.length === 0) {
    return { error: "আপনার কার্ট খালি রয়েছে।" };
  }
  const unavailable = cartWithDetails.find((i) => !i.isAvailable);
  if (unavailable) {
    return { error: `"${unavailable.product.name}" বর্তমানে স্টকে নেই। অনুগ্রহ করে কার্ট থেকে এটি সরিয়ে ফেলুন।` };
  }

  const subtotal = cartWithDetails.reduce((sum, i) => sum + i.lineTotal, 0);

  let discount = 0;
  let freeShipping = false;
  let appliedCoupon: typeof coupons.$inferSelect | null = null;

  if (couponCode) {
    const evaluation = await evaluateCoupon(
      couponCode,
      user.id,
      cartWithDetails.map((i) => ({
        productId: i.product.id,
        categoryId: i.product.categoryId,
        lineTotal: i.lineTotal,
      })),
    );
    if (!evaluation.ok) {
      return { error: evaluation.message };
    }
    discount = evaluation.discount;
    freeShipping = evaluation.freeShipping;
    appliedCoupon = evaluation.coupon;
  }

  const deliveryEstimate = calculateShippingFee(settings, shippingAddress.district, subtotal);
  const shippingFee = freeShipping ? 0 : deliveryEstimate.fee;
  const total = Math.max(0, subtotal - discount + shippingFee);

  // Idempotency guard against double submissions
  const recentDuplicate = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.userId, user.id),
        eq(orders.total, String(total)),
        gt(orders.createdAt, new Date(Date.now() - DUPLICATE_WINDOW_MS)),
      ),
    )
    .limit(1);
  if (recentDuplicate.length > 0) {
    redirect(`/my-orders/${recentDuplicate[0].orderNumber}?placed=1`);
  }

  let orderNumber = "";
  let emailPayload: EmailOrderPayload | null = null;

  const placeOrder = () => db.transaction(async (tx) => {
    // Re-validate stock inside the transaction to prevent overselling
    for (const item of cartWithDetails) {
      if (item.variant) {
        const [v] = await tx.select().from(productVariants).where(eq(productVariants.id, item.variant.id)).limit(1);
        const stock = v ? availableStock(v.stock, v.reservedStock) : 0;
        if (!v || !v.isActive || stock < item.quantity) {
          throw new Error(`${STOCK_ERROR_PREFIX}${item.product.name}`);
        }
      } else {
        const [p] = await tx.select().from(products).where(eq(products.id, item.product.id)).limit(1);
        const stock = p ? availableStock(p.stock, p.reservedStock) : 0;
        if (!p || !p.isActive || stock < item.quantity) {
          throw new Error(`${STOCK_ERROR_PREFIX}${item.product.name}`);
        }
      }
    }

    orderNumber = generateOrderNumber(settings?.orderPrefix || "ORD");

    const orderStatus = requiresDeliveryPrepay ? "pending_payment" : "pending";

    const [order] = await tx
      .insert(orders)
      .values({
        orderNumber,
        userId: user.id,
        status: orderStatus,
        paymentMethod,
        paymentStatus: "pending",
        transactionId: transactionId || null,
        subtotal: String(subtotal),
        discount: String(discount),
        shippingFee: String(shippingFee),
        total: String(total),
        couponCode: appliedCoupon?.code ?? null,
        recipientName: shippingAddress.recipientName,
        phone: shippingAddress.phone,
        division: shippingAddress.division,
        district: shippingAddress.district,
        upazila: shippingAddress.upazila,
        addressLine: shippingAddress.addressLine,
        customerNote: customerNote || null,
      })
      .returning();

    // One multi-row insert rather than a round-trip per line item.
    await tx.insert(orderItems).values(
      cartWithDetails.map((item) => ({
        orderId: order.id,
        productId: item.product.id,
        variantId: item.variant?.id ?? null,
        productName: item.product.name,
        variantName: item.variant?.name ?? null,
        image: item.variant?.image ?? item.product.thumbnail,
        price: String(item.priceInfo.price),
        quantity: item.quantity,
        total: String(item.lineTotal),
      })),
    )

    // Capture everything the AI email automation needs (sent after commit).
    emailPayload = {
      orderNumber: order.orderNumber,
      buyerName: user.name,
      buyerEmail: user.email,
      recipientName: order.recipientName,
      phone: order.phone,
      addressLine: order.addressLine,
      upazila: order.upazila,
      district: order.district,
      division: order.division,
      paymentMethod: PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod,
      transactionId: order.transactionId,
      subtotal: order.subtotal,
      discount: order.discount,
      shippingFee: order.shippingFee,
      total: order.total,
      storeName: settings?.storeName || "Markora",
      items: cartWithDetails.map((i) => ({
        productName: i.product.name,
        variantName: i.variant?.name ?? null,
        quantity: i.quantity,
        total: String(i.lineTotal),
      })),
    };

    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      status: orderStatus,
      note: requiresDeliveryPrepay
        ? "অর্ডারটি গ্রহণ করা হয়েছে। ডেলিভারি চার্জ প্রি-পেমেন্ট যাচাইয়ের অপেক্ষায় আছে।"
        : "অর্ডারটি গ্রহণ করা হয়েছে।",
    });

    // Unverified (new) buyers must pre-pay the delivery charge via
    // bKash/Nagad. The payment is recorded as PENDING here; only an authorized
    // admin or a configured gateway API can flip it to "verified" — the
    // frontend can never approve its own order.
    if (requiresDeliveryPrepay && transactionId) {
      await tx.insert(deliveryPayments).values({
        userId: user.id,
        orderId: order.id,
        paymentMethod,
        transactionId,
        deliveryCharge: String(shippingFee),
        paymentAmount: String(shippingFee),
        paymentStatus: "pending",
      });
    }

    // Notify admins so a new order is never missed.
    await tx.insert(notifications).values({
      audience: "admin",
      type: "new_order",
      title: "নতুন অর্ডার এসেছে",
      message: `অর্ডার ${order.orderNumber} — মোট ${order.total} টাকা।`,
      link: `/admin/orders/${order.orderNumber}`,
    });

    await reserveStockForOrder(
      tx,
      cartWithDetails.map((i) => ({
        productId: i.product.id,
        variantId: i.variant?.id ?? null,
        quantity: i.quantity,
      })),
    );

    if (appliedCoupon) {
      await tx
        .update(coupons)
        .set({ usedCount: sql`${coupons.usedCount} + 1` })
        .where(eq(coupons.id, appliedCoupon.id));
      await tx.insert(couponUsages).values({ couponId: appliedCoupon.id, userId: user.id, orderId: order.id });
    }

    // Count flash-sale purchases so the sold progress stays accurate. A single
    // statement handles every line: the per-product quantity is supplied as a
    // CASE expression rather than looping one UPDATE per cart line.
    const now = new Date();
    const quantityByProduct = new Map<number, number>();
    for (const item of cartWithDetails) {
      quantityByProduct.set(
        item.product.id,
        (quantityByProduct.get(item.product.id) ?? 0) + item.quantity,
      );
    }

    const soldIncrement = sql.join(
      [...quantityByProduct].map(
        ([productId, quantity]) =>
          sql`when ${flashSaleItems.productId} = ${productId} then ${quantity}`,
      ),
      sql` `,
    );

    await tx
      .update(flashSaleItems)
      .set({
        soldCount: sql`LEAST(${flashSaleItems.stockLimit}, ${flashSaleItems.soldCount} + (case ${soldIncrement} else 0 end))`,
      })
      .where(
        and(
          inArray(flashSaleItems.productId, [...quantityByProduct.keys()]),
          inArray(
            flashSaleItems.flashSaleId,
            tx
              .select({ id: flashSales.id })
              .from(flashSales)
              .where(
                and(
                  eq(flashSales.isActive, true),
                  lt(flashSales.startTime, now),
                  gt(flashSales.endTime, now),
                ),
              ),
          ),
        ),
      );

    await tx.delete(cartItems).where(
      and(eq(cartItems.userId, user.id), eq(cartItems.savedForLater, false)),
    );
  });

  try {
    await placeOrder();
  } catch (err) {
    // Re-throwing surfaced as the global error boundary - a blank crash screen
    // for what is usually a recoverable "someone bought it first" race. Both
    // cases are returned as form state so the buyer stays on checkout with
    // their cart intact.
    if (err instanceof Error && err.message.startsWith(STOCK_ERROR_PREFIX)) {
      const name = err.message.slice(STOCK_ERROR_PREFIX.length);
      return { error: `দুঃখিত, "${name}" এর প্রয়োজনীয় পরিমাণ স্টকে নেই।` };
    }
    // Database-level duplicate transaction guard (unique index on
    // delivery_payments.transaction_id, PG error code 23505).
    if ((err as { code?: string } | null)?.code === "23505") {
      return { error: "এই Transaction ID ইতিমধ্যে ব্যবহৃত হয়েছে। সঠিক Transaction ID দিন।" };
    }
    console.error("[checkout] order placement failed:", err);
    return { error: "অর্ডারটি সম্পন্ন করা যায়নি। একটু পরে আবার চেষ্টা করুন।" };
  }

  // AI automation: dispatch the order-confirmation email in the background.
  // The buyer is redirected immediately; email failures never block the order.
  if (emailPayload) {
    void sendOrderConfirmationEmail(emailPayload);
  }

  revalidatePath("/", "layout");
  revalidatePath("/cart");
  revalidatePath("/my-orders");
  redirect(`/my-orders/${orderNumber}?placed=1`);
}
