import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart, LogOut, MapPin, MessageSquare, Package, ShoppingCart, UserCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/actions/auth";
import { getUserAddresses } from "@/lib/queries/commerce";
import { countUnreadOrderMessages } from "@/lib/queries/orders";
import { getBuyerVerification, VERIFIED_BUYER_THRESHOLD } from "@/lib/verified-buyer";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";

export const metadata: Metadata = { title: "আমার অ্যাকাউন্ট", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/account");

  const [addresses, unreadMessages, verification] = await Promise.all([
    getUserAddresses(user.id),
    countUnreadOrderMessages(user.id),
    getBuyerVerification(user.id),
  ]);

  const links = [
    { href: "/my-orders", label: "আমার অর্ডার", desc: "অর্ডার স্ট্যাটাস ও বিবরণ দেখুন", icon: Package, badge: 0 },
    {
      href: "/account/messages",
      label: "অর্ডার সংক্রান্ত বার্তা",
      desc: "অ্যাডমিনের পাঠানো বার্তা দেখুন",
      icon: MessageSquare,
      badge: unreadMessages,
    },
    { href: "/wishlist", label: "পছন্দের তালিকা", desc: "সংরক্ষিত পণ্যগুলো দেখুন", icon: Heart, badge: 0 },
    { href: "/cart", label: "আমার কার্ট", desc: "কার্টে থাকা পণ্য দেখুন", icon: ShoppingCart, badge: 0 },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">আমার অ্যাকাউন্ট</h1>

      {/* Profile summary */}
      <div className="mt-4 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
          <UserCircle className="h-8 w-8" />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 truncate text-base font-semibold text-slate-900">
            {user.name}
            {verification.isVerifiedBuyer && <VerifiedBadge />}
          </p>
          <p className="truncate text-sm text-slate-500">{user.email}</p>
          {user.phone && <p className="text-sm text-slate-500">{user.phone}</p>}
        </div>
      </div>

      {/* Verified Buyer progress */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            সফল অর্ডার প্রগ্রেস
          </h2>
          {verification.isVerifiedBuyer ? (
            <VerifiedBadge />
          ) : (
            <span className="text-xs text-slate-500">
              Verified ব্যাজের জন্য আর {verification.remainingForVerification}টি সফল অর্ডার বাকি
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-1.5" aria-label={`${verification.successfulOrderCount} / ${VERIFIED_BUYER_THRESHOLD} সফল অর্ডার`}>
          {Array.from({ length: VERIFIED_BUYER_THRESHOLD }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 flex-1 rounded-full ${
                i < verification.successfulOrderCount ? "bg-teal-500" : "bg-slate-200"
              }`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {verification.successfulOrderCount}/{VERIFIED_BUYER_THRESHOLD} সফল ডেলিভারি সম্পন্ন —{" "}
          {VERIFIED_BUYER_THRESHOLD}টি সম্পন্ন হলে আপনি Markora Verified Buyer হবেন এবং ডেলিভারি চার্জ প্রি-পেমেন্টের
          প্রয়োজন থাকবে না।
        </p>
      </div>

      {/* Quick links */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {links.map(({ href, label, desc, icon: Icon, badge }) => (
          <Link
            key={href}
            href={href}
            className="relative flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-teal-500"
          >
            {badge > 0 && (
              <span className="absolute right-3 top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                {badge}
              </span>
            )}
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <Icon className="h-5 w-5" />
            </span>
            <span className="mt-2 text-sm font-semibold text-slate-900">{label}</span>
            <span className="text-xs text-slate-500">{desc}</span>
          </Link>
        ))}
      </div>

      {/* Saved addresses */}
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <MapPin className="h-4 w-4 text-teal-700" />
          সংরক্ষিত ঠিকানা
        </h2>
        {addresses.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            চেকআউটের সময় &quot;ঠিকানা সংরক্ষণ করুন&quot; নির্বাচন করলে সেটি এখানে দেখা যাবে।
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {addresses.map((addr) => (
              <li key={addr.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{addr.label}</span>
                  {addr.isDefault && (
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-800">
                      ডিফল্ট
                    </span>
                  )}
                </div>
                <p className="mt-1 text-slate-600">
                  {addr.recipientName} · {addr.phone}
                </p>
                <p className="text-slate-600">
                  {addr.addressLine}, {addr.upazila ? `${addr.upazila}, ` : ""}
                  {addr.district}, {addr.division}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Logout */}
      <form action={logoutAction} className="mt-6">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          লগআউট করুন
        </button>
      </form>
    </div>
  );
}
