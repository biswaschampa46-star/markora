import Link from "next/link";
import { BadgeCheck, ShieldCheck, XCircle, RotateCcw } from "lucide-react";

import {
  refundDeliveryPaymentFormAction,
  rejectDeliveryPaymentFormAction,
  verifyDeliveryPaymentFormAction,
} from "@/actions/payments";
import { Badge } from "@/components/ui/Badge";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { formatBanglaDate } from "@/lib/format";
import { DELIVERY_PAYMENT_STATUS_LABELS, statusBadgeTone } from "@/lib/status";
import { getDeliveryPayments } from "@/lib/queries/verified-buyers";

export const dynamic = "force-dynamic";
export const metadata = { title: "ডেলিভারি পেমেন্ট", robots: { index: false } };

export default async function DeliveryPaymentsPage() {
  const payments = await getDeliveryPayments();

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">ডেলিভারি প্রি-পেমেন্ট</h1>
      <p className="mt-1 text-sm text-slate-500">
        নতুন ক্রেতাদের ডেলিভারি চার্জ প্রি-পেমেন্ট যাচাই করুন। যাচাই হলে অর্ডার স্বয়ংক্রিয়ভাবে প্রসেসিংয়ে যাবে।
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {payments.map((p) => (
          <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/orders/${p.orderNumber}`}
                    className="font-semibold text-teal-700 hover:underline"
                  >
                    {p.orderNumber}
                  </Link>
                  <Badge tone={statusBadgeTone(p.paymentStatus)}>
                    {DELIVERY_PAYMENT_STATUS_LABELS[p.paymentStatus] ?? p.paymentStatus}
                  </Badge>
                  <Badge tone={statusBadgeTone(p.orderStatus)}>{p.orderStatus}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-700">
                  {p.customerName} <span className="text-slate-400">·</span> {p.customerEmail}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {p.paymentMethod.toUpperCase()} TxnID: <span className="font-mono">{p.transactionId}</span>
                  {" · "}
                  {formatBanglaDate(p.createdAt)}
                </p>
                {p.verificationMethod && (
                  <p className="mt-0.5 text-xs text-slate-500">যাচাই: {p.verificationMethod}</p>
                )}
              </div>
              <div className="text-right">
                <PriceDisplay price={Number(p.paymentAmount)} size="md" />
                <p className="text-xs text-slate-500">ডেলিভারি চার্জ: ৳{Number(p.deliveryCharge).toFixed(0)}</p>
              </div>
            </div>

            {p.paymentStatus === "pending" && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                <form action={verifyDeliveryPaymentFormAction}>
                  <input type="hidden" name="paymentId" value={p.id} />
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
                  >
                    <BadgeCheck className="h-4 w-4" />
                    যাচাই করুন
                  </button>
                </form>
                <form action={rejectDeliveryPaymentFormAction} className="flex items-center gap-2">
                  <input type="hidden" name="paymentId" value={p.id} />
                  <input
                    type="text"
                    name="note"
                    placeholder="কারণ (ঐচ্ছিক)"
                    className="w-44 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4" />
                    বাতিল
                  </button>
                </form>
              </div>
            )}

            {p.paymentStatus === "verified" && (
              <form action={refundDeliveryPaymentFormAction} className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                <input type="hidden" name="paymentId" value={p.id} />
                <input
                  type="text"
                  name="note"
                  placeholder="রিফান্ডের কারণ (ঐচ্ছিক)"
                  className="w-52 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-lg border border-amber-200 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  রিফান্ড
                </button>
              </form>
            )}

            {p.paymentStatus !== "pending" && p.paymentStatus !== "verified" && (
              <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                এই পেমেন্টটি {DELIVERY_PAYMENT_STATUS_LABELS[p.paymentStatus] ?? p.paymentStatus} অবস্থায় আছে।
              </p>
            )}
          </div>
        ))}
        {payments.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            এখনও কোনো ডেলিভারি প্রি-পেমেন্ট নেই।
          </p>
        )}
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        নিরাপত্তা: bKash/Nagad মার্চেন্ট অ্যাপে TxnID ও পরিমাণ মিলিয়ে নিয়েই &quot;যাচাই করুন&quot; চাপুন। গেটওয়ে API
        কনফিগার থাকলে সিস্টেম স্বয়ংক্রিয়ভাবে গেটওয়ের সাথে মিলিয়ে দেখবে — গেটওয়ে অস্বীকার করলে যাচাই হবে না।
      </p>
    </div>
  );
}
