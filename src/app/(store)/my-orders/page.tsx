import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch, UserRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getUserOrders } from "@/lib/queries/orders";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { TrackOrderForm } from "@/components/buyer/TrackOrderForm";
import { ORDER_STATUS_LABELS, statusBadgeTone } from "@/lib/status";
import { formatBanglaDate } from "@/lib/format";

export const metadata: Metadata = { title: "আমার অর্ডার", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MyOrdersPage() {
  const user = await getCurrentUser();
  const orders = user ? await getUserOrders(user.id) : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">অর্ডার ট্র্যাক করুন</h1>

      {!user && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-800">অর্ডার নম্বর দিয়ে ট্র্যাক করুন</p>
          <div className="mt-3">
            <TrackOrderForm />
          </div>
          <Link
            href="/login?redirect=/my-orders"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:underline"
          >
            <UserRound className="h-4 w-4" />
            লগইন করে সব অর্ডার দেখুন
          </Link>
        </div>
      )}

      {user && orders.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={<PackageSearch className="h-7 w-7" />} title="এখনও কোনো অর্ডার পাওয়া যায়নি।" />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/my-orders/${order.orderNumber}`}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 hover:border-teal-500 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">অর্ডার নং: {order.orderNumber}</p>
                <p className="text-xs text-slate-500">{formatBanglaDate(order.createdAt)}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={statusBadgeTone(order.status)}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge>
                <PriceDisplay price={Number(order.total)} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
