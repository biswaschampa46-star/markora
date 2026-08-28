import Link from "next/link";
import { desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, products, reviews } from "@/db/schema";
import { Badge } from "@/components/ui/Badge";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { ORDER_STATUS_LABELS, statusBadgeTone } from "@/lib/status";
import { formatBanglaDate } from "@/lib/format";
import { DashboardReset } from "@/components/admin/DashboardReset";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [orderStats, productCount, pendingReviews, recentOrders, revenue] = await Promise.all([
    db
      .select({ status: orders.status, c: sql<number>`COUNT(*)::int` })
      .from(orders)
      .groupBy(orders.status),
    db.select({ c: sql<number>`COUNT(*)::int` }).from(products),
    db.select({ c: sql<number>`COUNT(*)::int` }).from(reviews).where(eq(reviews.status, "pending")),
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8),
    db
      .select({ total: sql<string>`COALESCE(SUM(${orders.total}), 0)` })
      .from(orders)
      .where(ne(orders.status, "cancelled")),
  ]);

  const statusCount = Object.fromEntries(orderStats.map((r) => [r.status, r.c]));
  const totalOrders = orderStats.reduce((s, r) => s + r.c, 0);

  const stats = [
    { label: "মোট অর্ডার", value: String(totalOrders), href: "/admin/orders" },
    { label: "অপেক্ষমাণ অর্ডার", value: String(statusCount["pending"] ?? 0), href: "/admin/orders?status=pending" },
    {
      label: "সফল ডেলিভারি",
      value: String(statusCount["delivered"] ?? 0),
      href: "/admin/orders?status=delivered",
    },
    { label: "মোট পণ্য", value: String(productCount[0]?.c ?? 0), href: "/admin/products" },
    { label: "নতুন পর্যালোচনা", value: String(pendingReviews[0]?.c ?? 0), href: "/admin/reviews" },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">ড্যাশবোর্ড</h1>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-teal-500"
          >
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs text-slate-500">মোট বিক্রয় (বাতিল বাদে)</p>
        <PriceDisplay price={Number(revenue[0]?.total ?? 0)} size="lg" />
      </div>

      <h2 className="mt-8 text-sm font-semibold text-slate-900">সাম্প্রতিক অর্ডার</h2>
      {recentOrders.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">এখনও কোনো অর্ডার আসেনি।</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {recentOrders.map((order) => (
            <Link
              key={order.id}
              href={`/admin/orders/${order.orderNumber}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm hover:border-teal-500"
            >
              <span>
                <span className="font-medium text-slate-800">{order.orderNumber}</span>
                <span className="ml-2 text-slate-500">{formatBanglaDate(order.createdAt)}</span>
              </span>
              <span className="flex items-center gap-3">
                <Badge tone={statusBadgeTone(order.status)}>
                  {ORDER_STATUS_LABELS[order.status] ?? order.status}
                </Badge>
                <PriceDisplay price={Number(order.total)} size="sm" />
              </span>
            </Link>
          ))}
        </div>
      )}

      <DashboardReset />
    </div>
  );
}
