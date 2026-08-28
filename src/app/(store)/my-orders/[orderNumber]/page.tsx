import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, CheckCircle2, ImageOff, MessageSquare, PhoneOff, UserCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getOrderDetail, getOrderMessages } from "@/lib/queries/orders";
import { getStoreSettings } from "@/lib/settings";
import { Badge } from "@/components/ui/Badge";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { getBuyerVerification } from "@/lib/verified-buyer";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { CancelOrderButton } from "@/components/buyer/CancelOrderButton";
import {
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  statusBadgeTone,
} from "@/lib/status";
import { formatBDT, formatBanglaDate, formatBanglaDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "অর্ডার বিস্তারিত", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  // Guests may track a single order by its exact number — the footer's
  // "অর্ডার ট্র্যাক করুন" link works without an account.
  const user = await getCurrentUser();
  const { orderNumber } = await params;
  const { placed } = await searchParams;

  const detail =
    user
      ? await getOrderDetail(orderNumber, user.id)
      : await getOrderDetail(orderNumber); // guest: lookup by order number only
  if (!detail) notFound();

  const { order, items, history } = detail;
  const isCancelled = ["cancelled", "returned", "refunded", "failed"].includes(order.status);
  const currentStepIndex = ORDER_STATUS_FLOW.indexOf(order.status);

  // Order messages + placing-account info are only for the owning account.
  const isOwner = Boolean(user && order.userId === user.id);
  const [messages, settings] = isOwner
    ? await Promise.all([getOrderMessages(order.id), getStoreSettings()])
    : [[], null];
  // Authoritative verification state — badge is shown only if the server
  // confirms the buyer has completed the required successful orders.
  const verification = isOwner && user ? await getBuyerVerification(user.id) : null;
  const whatsappDigits = (settings?.whatsapp ?? "").replace(/[^\d]/g, "");
  const whatsappLink = whatsappDigits
    ? `https://wa.me/${whatsappDigits.startsWith("88") ? whatsappDigits : `88${whatsappDigits}`}`
    : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      {placed === "1" && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5" /> আপনার অর্ডার সফলভাবে গ্রহণ করা হয়েছে।
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">অর্ডার নং: {order.orderNumber}</h1>
          <p className="text-sm text-slate-500">{formatBanglaDateTime(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-3">
          {user && order.status === "pending" && <CancelOrderButton orderNumber={order.orderNumber} />}
          <Badge tone={statusBadgeTone(order.status)}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge>
        </div>
      </div>

      {/* Which account placed this order */}
      {isOwner && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <UserCircle className="h-8 w-8 shrink-0 text-teal-700" />
          <p className="text-slate-600">
            এই অর্ডারটি করা হয়েছে <span className="font-semibold text-slate-900">{user!.name}</span>{" "}
            {verification?.isVerifiedBuyer && <VerifiedBadge className="align-middle" />} (
            {user!.email}) অ্যাকাউন্ট থেকে।
          </p>
        </div>
      )}

      {/* Order messages (read-only — no replies, WhatsApp/Facebook only, no calls) */}
      {isOwner && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <MessageSquare className="h-4 w-4 text-teal-700" />
            অর্ডার সংক্রান্ত বার্তা ({messages.length})
          </h2>
          {messages.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">এই অর্ডারে এখনও কোনো বার্তা নেই।</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {messages.map((m) => (
                <li key={m.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="text-slate-800">{m.message}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {m.sentByName ?? "Markora টিম"} · {formatBanglaDateTime(m.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500">
            বার্তার উত্তর দেওয়া যাবে না — কথা বলার জন্য{" "}
            {whatsappLink ? (
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-700 hover:underline">
                WhatsApp
              </a>
            ) : (
              "WhatsApp"
            )}{" "}
            বা{" "}
            {settings?.facebook ? (
              <a href={settings.facebook} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 hover:underline">
                Facebook
              </a>
            ) : (
              "Facebook"
            )}
            -এ মেসেজ দিন। <span className="inline-flex items-center gap-1 font-medium text-red-600"><PhoneOff className="h-3.5 w-3.5" /> ফোন কল গ্রহণ করা হয় না।</span>
          </p>
        </div>
      )}

      {order.expectedDeliveryAt && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm">
          <CalendarDays className="h-5 w-5 shrink-0 text-teal-700" />
          <p className="text-slate-700">
            প্রত্যাশিত ডেলিভারি তারিখ:{" "}
            <span className="font-semibold text-teal-800">{formatBanglaDate(order.expectedDeliveryAt)}</span>
          </p>
        </div>
      )}

      {!isCancelled && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex min-w-max items-center">
            {ORDER_STATUS_FLOW.map((step, i) => (
              <div key={step} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      i <= currentStepIndex ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <span className="w-20 text-center text-[11px] text-slate-500">{ORDER_STATUS_LABELS[step]}</span>
                </div>
                {i < ORDER_STATUS_FLOW.length - 1 && (
                  <div className={`h-0.5 w-10 ${i < currentStepIndex ? "bg-teal-700" : "bg-slate-200"}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800">পণ্যসমূহ</h2>
            <div className="mt-3 flex flex-col divide-y divide-slate-100">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3 py-3">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {item.image ? (
                      <Image src={item.image} alt={item.productName} fill sizes="64px" className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300">
                        <ImageOff className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <p className="text-sm font-medium text-slate-800">{item.productName}</p>
                    {item.variantName && <p className="text-xs text-slate-500">{item.variantName}</p>}
                    <p className="text-xs text-slate-500">
                      {formatBDT(item.price)} × {item.quantity}
                    </p>
                  </div>
                  <PriceDisplay price={Number(item.total)} size="sm" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800">অর্ডারের ইতিহাস</h2>
            <ul className="mt-3 flex flex-col gap-3">
              {history.map((h) => (
                <li key={h.id} className="flex items-start gap-3 text-sm">
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-700" />
                  <div>
                    <p className="font-medium text-slate-800">{ORDER_STATUS_LABELS[h.status] ?? h.status}</p>
                    {h.note && <p className="text-xs text-slate-500">{h.note}</p>}
                    <p className="text-xs text-slate-400">{formatBanglaDateTime(h.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800">ডেলিভারি ঠিকানা</h2>
            <p className="mt-2 text-sm text-slate-600">
              {order.recipientName} — {order.phone}
              <br />
              {order.addressLine}, {order.upazila ? `${order.upazila}, ` : ""}
              {order.district}, {order.division}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800">পেমেন্ট তথ্য</h2>
            <div className="mt-2 space-y-1 text-sm text-slate-600">
              <p>পদ্ধতিঃ {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}</p>
              <p>অবস্থাঃ {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}</p>
              {order.transactionId && <p>লেনদেন আইডিঃ {order.transactionId}</p>}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800">মূল্য বিবরণ</h2>
            <div className="mt-2 space-y-1 text-sm text-slate-600">
              <div className="flex justify-between"><span>সাবটোটাল</span><span>{formatBDT(order.subtotal)}</span></div>
              {Number(order.discount) > 0 && (
                <div className="flex justify-between text-emerald-700"><span>ছাড়</span><span>- {formatBDT(order.discount)}</span></div>
              )}
              <div className="flex justify-between"><span>ডেলিভারি চার্জ</span><span>{formatBDT(order.shippingFee)}</span></div>
              <div className="flex justify-between border-t border-slate-100 pt-1 text-base font-bold text-slate-900">
                <span>সর্বমোট</span><span>{formatBDT(order.total)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            কোনো সমস্যা হলে <Link href="/contact" className="font-medium text-teal-700">সহায়তা কেন্দ্রে</Link> যোগাযোগ করুন।
          </div>
        </div>
      </div>
    </div>
  );
}
