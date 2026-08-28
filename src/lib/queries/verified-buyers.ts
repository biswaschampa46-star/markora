import "server-only";
import { db } from "@/db";
import { deliveryPayments, orders, users } from "@/db/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";

/**
 * Admin-facing reads for the Verified Buyers dashboard
 * (/admin/verified-buyers). Admin pages run behind requireAdmin() and use the
 * server's direct Postgres connection; buyers can only ever reach their own
 * data through the buyer-scoped queries.
 */

export type VerifiedBuyerRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  successfulOrderCount: number;
  isVerifiedBuyer: boolean;
  verifiedAt: Date | null;
  createdAt: Date;
};

/** Every customer with their verification progress, verified buyers first. */
export async function getVerifiedBuyersOverview(): Promise<VerifiedBuyerRow[]> {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      successfulOrderCount: users.successfulOrderCount,
      isVerifiedBuyer: users.isVerifiedBuyer,
      verifiedAt: users.verifiedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.role, "customer"))
    .orderBy(desc(users.isVerifiedBuyer), desc(users.successfulOrderCount))
    .limit(200);
}

export type DeliveryPaymentRow = {
  id: number;
  paymentMethod: string;
  transactionId: string;
  deliveryCharge: string;
  paymentAmount: string;
  paymentStatus: string;
  verificationMethod: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  orderNumber: string;
  orderStatus: string;
  customerName: string;
  customerEmail: string;
};

/**
 * All delivery pre-payments, pending verifications first so the admin never
 * misses one. Joined with order + customer for context.
 */
export async function getDeliveryPayments(): Promise<DeliveryPaymentRow[]> {
  return db
    .select({
      id: deliveryPayments.id,
      paymentMethod: deliveryPayments.paymentMethod,
      transactionId: deliveryPayments.transactionId,
      deliveryCharge: deliveryPayments.deliveryCharge,
      paymentAmount: deliveryPayments.paymentAmount,
      paymentStatus: deliveryPayments.paymentStatus,
      verificationMethod: deliveryPayments.verificationMethod,
      verifiedAt: deliveryPayments.verifiedAt,
      createdAt: deliveryPayments.createdAt,
      orderNumber: orders.orderNumber,
      orderStatus: orders.status,
      customerName: users.name,
      customerEmail: users.email,
    })
    .from(deliveryPayments)
    .innerJoin(orders, eq(deliveryPayments.orderId, orders.id))
    .innerJoin(users, eq(deliveryPayments.userId, users.id))
    .orderBy(asc(deliveryPayments.paymentStatus), desc(deliveryPayments.createdAt))
    .limit(200);
}

/** The delivery payment attached to an order (used by the verify action). */
export async function getDeliveryPaymentById(paymentId: number) {
  const [row] = await db
    .select()
    .from(deliveryPayments)
    .where(eq(deliveryPayments.id, paymentId))
    .limit(1);
  return row ?? null;
}

/** Counters for the dashboard section headers. */
export async function getVerificationStats() {
  const [verified] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.isVerifiedBuyer, true), eq(users.role, "customer")));
  const [pendingPayments] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(deliveryPayments)
    .where(eq(deliveryPayments.paymentStatus, "pending"));
  return {
    verifiedBuyers: Number(verified?.count ?? 0),
    pendingPayments: Number(pendingPayments?.count ?? 0),
  };
}