import Link from "next/link";
import { Search } from "lucide-react";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { Badge } from "@/components/ui/Badge";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { EmptyState } from "@/components/ui/EmptyState";
import { ORDER_STATUS_LABELS, ORDER_STATUS_FLOW, statusBadgeTone } from "@/lib/status";
import { formatBanglaDate, toBanglaDigits } from "@/lib/format";

export const dynamic = "force-dynamic";

const VALID_STATUSES = [...ORDER_STATUS_FLOW, "cancelled", "returned", "refund_requested", "refunded", "failed"];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const filter = status && VALID_STATUSES.includes(status) ? status : null;
  // Keep hyphens/case: order numbers look like "ORD-260827-067704" and are
  // stored WITH hyphens, so we must match the typed form, not strip it.
  const rawQuery = (q ?? "").trim();

  const conditions: SQL[] = [];
  if (filter) conditions.push(eq(orders.status, filter));

  if (rawQuery) {
    // Order-number like: lowercase, collapse whitespace, KEEP hyphens.
    const orderLike = `%${rawQuery.toLowerCase().replace(/\s+/g, "")}%`;
    const phoneDigits = rawQuery.replace(/\D/g, "");

    if (phoneDigits.length >= 3) {
      // Digits present → match order number AND phone number together.
      conditions.push(
        or(ilike(orders.orderNumber, orderLike), ilike(orders.phone, `%${phoneDigits}%`)) as SQL,
      );
    } else {
      conditions.push(ilike(orders.orderNumber, orderLike));
    }
  }

  const rows = await db
    .select()
    .from(orders)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(200);

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">অর্ডারসমূহ</h1>

      {/* Search box — filter by order number (and phone if numeric) */}
      <form className="mt-3 flex max-w-md items-center gap-2" method="get">
        {status && <input type="hidden" name="status" value={status} />}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="অর্ডার নং দিয়ে খুঁজুন (যেমন: ORD-123)"
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-teal-600 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="h-10 rounded-lg bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800"
        >
          খুঁজুন
        </button>
        {q && (
          <Link
            href={status ? `/admin/orders?status=${status}` : "/admin/orders"}
            className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-3 text-sm text-slate-500 hover:bg-slate-50"
          >
            পরিষ্কার
          </Link>
        )}
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={q ? `/admin/orders?q=${encodeURIComponent(q)}` : "/admin/orders"}
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
            !filter ? "bg-teal-700 text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          সব
        </Link>
        {[...ORDER_STATUS_FLOW, "cancelled", "failed", "refund_requested", "refunded"].map((s) => (
          <Link
            key={s}
            href={`/admin/orders?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              filter === s ? "bg-teal-700 text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {ORDER_STATUS_LABELS[s] ?? s}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title={q ? "সার্চে কোনো অর্ডার পাওয়া যায়নি।" : "এই ফিল্টারে কোনো অর্ডার নেই।"} />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-2 text-xs text-slate-400">
            {toBanglaDigits(rows.length)} টি অর্ডার {q ? `"${q}"` : ""} {filter ? `· ${ORDER_STATUS_LABELS[filter]}` : ""}
          </div>
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">অর্ডার নং</th>
                <th className="px-4 py-3">তারিখ</th>
                <th className="px-4 py-3">প্রাপক</th>
                <th className="px-4 py-3">পেমেন্ট</th>
                <th className="px-4 py-3">স্ট্যাটাস</th>
                <th className="px-4 py-3 text-right">মোট</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <tr key={order.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${order.orderNumber}`} className="font-medium text-teal-700 hover:underline">
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatBanglaDate(order.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className="text-slate-800">{order.recipientName}</span>
                    <span className="block text-xs text-slate-500">{toBanglaDigits(order.phone)}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {{ bkash: "বিকাশ", nagad: "নগদ", rocket: "রকেট", cod: "COD" }[order.paymentMethod] ?? order.paymentMethod}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusBadgeTone(order.status)}>
                      {ORDER_STATUS_LABELS[order.status] ?? order.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PriceDisplay price={Number(order.total)} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
