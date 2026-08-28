import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { sendOrderMessageFormAction, setExpectedDeliveryFormAction, updateOrderStatusFormAction } from "@/actions/admin";
import { getOrderDetail, getOrderMessages } from "@/lib/queries/orders";
import { Badge } from "@/components/ui/Badge";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import {
  ALLOWED_TRANSITIONS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  statusBadgeTone,
} from "@/lib/status";
import { formatBanglaDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const detail = await getOrderDetail(orderNumber);
  if (!detail) notFound();

  const { order, items, history } = detail;
  const nextStatuses = ALLOWED_TRANSITIONS[order.status] ?? [];
  const messages = await getOrderMessages(order.id);

  return (
    <div className="max-w-4xl">
      <Link href="/admin/orders" className="text-sm text-teal-700 hover:underline">
        ← সব অর্ডার
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">অর্ডার {order.orderNumber}</h1>
        <Badge tone={statusBadgeTone(order.status)}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge>
      </div>
      <p className="mt-1 text-xs text-slate-500">{formatBanglaDate(order.createdAt)}</p>

      {/* One-way message to the buyer */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <MessageSquare className="h-4 w-4 text-teal-700" />
          বার্তা পাঠান (অর্ডার সংক্রান্ত)
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          ক্রেতা বার্তাটি পড়তে পারবে কিন্তু উত্তর দিতে পারবে না — কথা বলার জন্য তাকে WhatsApp/Facebook-এ মেসেজ করতে বলুন।
        </p>

        {messages.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {messages.map((m) => (
              <li key={m.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="text-slate-800">{m.message}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {m.sentByName ?? "অ্যাডমিন"} · {formatBanglaDate(m.createdAt)} ·{" "}
                  {m.isRead ? "পড়া হয়েছে ✓" : "অপঠিত"}
                </p>
              </li>
            ))}
          </ul>
        )}

        <form action={sendOrderMessageFormAction} className="mt-3">
          <input type="hidden" name="orderId" value={order.id} />
          <textarea
            name="message"
            required
            rows={2}
            maxLength={2000}
            placeholder="ক্রেতার জন্য বার্তা লিখুন (যেমন: আপনার পণ্য কুরিয়ারে পাঠানো হয়েছে)... "
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="mt-2 h-9 rounded-lg bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800"
          >
            বার্তা পাঠান
          </button>
        </form>
      </div>

      {/* Status transition actions */}
      {nextStatuses.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">স্ট্যাটাস পরিবর্তন</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {nextStatuses.map((s) => (
              <form key={s} action={updateOrderStatusFormAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="status" value={s} />
                <button
                  type="submit"
                  className={`h-9 rounded-lg px-3 text-sm font-medium ${
                    s === "cancelled" || s === "failed"
                      ? "border border-red-200 bg-white text-red-600 hover:bg-red-50"
                      : "bg-teal-700 text-white hover:bg-teal-800"
                  }`}
                >
                  {s === "confirmed"
                    ? "নিশ্চিত করুন"
                    : s === "cancelled"
                      ? "বাতিল করুন"
                      : `→ ${ORDER_STATUS_LABELS[s] ?? s}`}
                </button>
              </form>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            বাতিল করলে সংরক্ষিত স্টক মুক্ত হবে; ডেলিভারি সম্পন্নে স্টক চূড়ান্তভাবে কমবে ও বিক্রয় গণনা বাড়বে।
          </p>
        </div>
      )}

      {/* Expected delivery date — admin fixes it manually, buyer sees it on /my-orders */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">প্রত্যাশিত ডেলিভারি তারিখ</p>
        <p className="mt-1 text-xs text-slate-400">
          ক্রেতা এই তারিখটি তার অর্ডার পেজে দেখতে পাবে। খালি রেখে জমা দিলে তারিখ মুছে যাবে।
        </p>
        {order.expectedDeliveryAt && (
          <p className="mt-2 text-sm text-slate-700">
            বর্তমান তারিখ: <span className="font-medium">{formatBanglaDate(order.expectedDeliveryAt)}</span>
          </p>
        )}
        <form action={setExpectedDeliveryFormAction} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="orderId" value={order.id} />
          <input
            type="date"
            name="expectedDeliveryAt"
            defaultValue={order.expectedDeliveryAt ? order.expectedDeliveryAt.toISOString().slice(0, 10) : ""}
            className="h-9 rounded-lg border border-slate-300 px-3 text-sm"
          />
          <button type="submit" className="h-9 rounded-lg bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800">
            তারিখ নির্ধারণ করুন
          </button>
        </form>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Items */}
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">পণ্যসমূহ</h2>
          <ul className="mt-3 flex flex-col divide-y divide-slate-100">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="block text-sm text-slate-800">{item.productName}</span>
                  <span className="text-xs text-slate-500">
                    {item.variantName ? `${item.variantName} · ` : ""}পরিমাণ: {item.quantity}
                  </span>
                </span>
                <PriceDisplay price={Number(item.total)} size="sm" />
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">সাবটোটাল</dt>
              <dd><PriceDisplay price={Number(order.subtotal)} size="sm" /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">ছাড় {order.couponCode ? `(${order.couponCode})` : ""}</dt>
              <dd>-<PriceDisplay price={Number(order.discount)} size="sm" /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">ডেলিভারি</dt>
              <dd><PriceDisplay price={Number(order.shippingFee)} size="sm" /></dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>সর্বমোট</dt>
              <dd><PriceDisplay price={Number(order.total)} /></dd>
            </div>
          </dl>
        </section>

        {/* Meta */}
        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <h2 className="font-semibold text-slate-900">গ্রাহক ও ঠিকানা</h2>
            <p className="mt-2 text-slate-700">{order.recipientName}</p>
            <p className="text-slate-600">{order.phone}</p>
            <p className="mt-1 text-slate-600">
              {order.addressLine}, {order.upazila ? `${order.upazila}, ` : ""}
              {order.district}, {order.division}
            </p>
            {order.customerNote && (
              <p className="mt-2 rounded-lg bg-slate-50 p-2 text-slate-600">নোট: {order.customerNote}</p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <h2 className="font-semibold text-slate-900">পেমেন্ট</h2>
            <p className="mt-2 text-slate-600">
              {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}
              {" · "}
              <Badge tone={statusBadgeTone(order.paymentStatus === "successful" ? "delivered" : order.paymentStatus)}>
                {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
              </Badge>
            </p>
            {order.transactionId && (
              <p className="mt-1 break-all text-xs text-slate-500">TxnID: {order.transactionId}</p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">ইতিহাস</h2>
            <ol className="mt-3 space-y-2 border-l-2 border-slate-100 pl-4">
              {history.map((h) => (
                <li key={h.id} className="text-sm">
                  <span className="font-medium text-slate-700">{ORDER_STATUS_LABELS[h.status] ?? h.status}</span>
                  <span className="ml-2 text-xs text-slate-400">{formatBanglaDate(h.createdAt)}</span>
                  {h.note && <span className="block text-xs text-slate-500">{h.note}</span>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
