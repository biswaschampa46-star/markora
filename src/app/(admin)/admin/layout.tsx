import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, Package, PackagePlus, Settings, ShoppingCart, Star, Image, Tags, Zap, BadgeCheck, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { logoutAction } from "@/actions/auth";
import { NotificationBell } from "@/components/shared/NotificationBell";

export const metadata: Metadata = { title: "অ্যাডমিন প্যানেল", robots: { index: false } };
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "ড্যাশবোর্ড", icon: LayoutDashboard },
  { href: "/admin/products", label: "পণ্যসমূহ", icon: PackagePlus },
  { href: "/admin/orders", label: "অর্ডারসমূহ", icon: ShoppingCart },
  { href: "/admin/delivery-payments", label: "ডেলিভারি পেমেন্ট", icon: Wallet },
  { href: "/admin/verified-buyers", label: "ভেরিফায়েড ক্রেতা", icon: BadgeCheck },
  { href: "/admin/reviews", label: "পর্যালোচনা", icon: Star },
  { href: "/admin/banners", label: "ব্যানার", icon: Image },
  { href: "/admin/categories", label: "ক্যাটাগরি", icon: Tags },
  { href: "/admin/flash-sales", label: "ফ্ল্যাশ সেল", icon: Zap },
  { href: "/admin/settings", label: "সেটিংস", icon: Settings },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) redirect("/login?redirect=/admin");

  return (
    <div className="flex min-h-screen bg-[#f7f8fa]">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">মার্কোরা অ্যাডমিন</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{admin.name}</p>
          </div>
          <NotificationBell scope="admin" />
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-800"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          <Link
            href="/"
            className="mt-2 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
          >
            <Package className="h-4 w-4" />
            স্টোরে ফিরে যান
          </Link>
        </nav>
        <form action={logoutAction} className="mt-auto p-2">
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
          >
            লগআউট
          </button>
        </form>
      </aside>
      <main className="flex-1 overflow-x-auto p-5 lg:p-8">{children}</main>
    </div>
  );
}
