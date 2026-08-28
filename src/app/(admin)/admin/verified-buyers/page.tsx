import Link from "next/link";
import { BadgeCheck, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { formatBanglaDate } from "@/lib/format";
import { DELIVERY_PAYMENT_STATUS_LABELS, statusBadgeTone } from "@/lib/status";
import { VERIFIED_BUYER_THRESHOLD } from "@/lib/verified-buyer";
import { getDeliveryPayments, getVerifiedBuyersOverview, getVerificationStats } from "@/lib/queries/verified-buyers";

export const dynamic = "force-dynamic";
export const metadata = { title: "ভেরিফায়েড ক্রেতা", robots: { index: false } };

export default async function VerifiedBuyersPage() {
  const [buyers, payments, stats] = await Promise.all([
    getVerifiedBuyersOverview(),
    getDeliveryPayments(),
    getVerificationStats(),
  ]);

  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
        <BadgeCheck className="h-6 w-6 text-teal-600" />
        ভেরিফায়েড ক্রেতা
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {VERIFIED_BUYER_THRESHOLD}টি সফল ডেলিভারি সম্পন্ন ক্রেতা স্বয়ংক্রিয়ভাবে Markora Verified Buyer ব্যাজ পান।
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">ভেরিফায়েড ক্রেতা</p>
          <p className="mt-1 text-2xl font-bold text-teal-700">{stats.verifiedBuyers}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">অপেক্ষমাণ পেমেন্ট যাচাই</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{stats.pendingPayments}</p>
        </div>
        <Link
          href="/admin/delivery-payments"
          className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-teal-500"
        >
          <p className="text-xs text-slate-500">ডেলিভারি পেমেন্ট ম্যানেজমেন্ট</p>
          <p className="mt-1 text-sm font-semibold text-teal-700">খুলুন →</p>
        </Link>
      </div>

      <h2 className="mt-8 text-sm font-semibold text-slate-900">ক্রেতা তালিকা</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="px-4 py-3">ক্রেতা</th>
              <th className="px-4 py-3">সফল অর্ডার</th>
              <th className="px-4 py-3">অবস্থা</th>
              <th className="px-4 py-3">ভেরিফাইড হয়েছে</th>
            </tr>
          </thead>
          <tbody>
            {buyers.map((b) => (
              <tr key={b.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{b.name}</p>
                  <p className="text-xs text-slate-500">{b.email}</p>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {b.successfulOrderCount} / {VERIFIED_BUYER_THRESHOLD}
                </td>
                <td className="px-4 py-3">
                  {b.isVerifiedBuyer ? (
                    <Badge tone="success">
                      <BadgeCheck className="mr-1 inline h-3.5 w-3.5" />
                      Verified Buyer
                    </Badge>
                  ) : (
                    <Badge tone="neutral">
                      {VERIFIED_BUYER_THRESHOLD - b.successfulOrderCount}টি অর্ডার বাকি
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {b.verifiedAt ? formatBanglaDate(b.verifiedAt) : "—"}
                </td>
              </tr>
            ))}
            {buyers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  এখনও কোনো ক্রেতা নেই।
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-sm font-semibold text-slate-900">সাম্প্রতিক ডেলিভারি প্রি-পেমেন্ট</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="px-4 py-3">অর্ডার</th>
              <th className="px-4 py-3">ক্রেতা</th>
              <th className="px-4 py-3">পরিমাণ</th>
              <th className="px-4 py-3">অবস্থা</th>
            </tr>
          </thead>
          <tbody>
            {payments.slice(0, 10).map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${p.orderNumber}`} className="font-medium text-teal-700 hover:underline">
                    {p.orderNumber}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {p.paymentMethod.toUpperCase()} · {p.transactionId}
                  </p>
                </td>
                <td className="px-4 py-3 text-slate-700">{p.customerName}</td>
                <td className="px-4 py-3">
                  <PriceDisplay price={Number(p.paymentAmount)} size="sm" />
                </td>
                <td className="px-4 py-3">
                  <Badge tone={statusBadgeTone(p.paymentStatus)}>
                    {DELIVERY_PAYMENT_STATUS_LABELS[p.paymentStatus] ?? p.paymentStatus}
                  </Badge>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  এখনও কোনো ডেলিভারি প্রি-পেমেন্ট নেই।
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        নিরাপত্তা: পেমেন্ট শুধুমাত্র গেটওয়ে API নিশ্চিত করলে অথবা আপনি মার্চেন্ট অ্যাপে TxnID মিলিয়ে ম্যানুয়ালি
        যাচাই করলেই &quot;verified&quot; হয়। ক্রেতার ফ্রন্টএন্ড কখনোই নিজের পেমেন্ট যাচাই করতে পারে না।
      </p>
    </div>
  );
}
