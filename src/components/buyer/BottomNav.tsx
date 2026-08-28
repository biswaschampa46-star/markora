"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Home, LayoutGrid, ShoppingCart, User } from "lucide-react";
import { toBanglaDigits } from "@/lib/format";

export function BottomNav({
  cartCount,
  wishlistCount,
  isLoggedIn,
}: {
  cartCount: number;
  wishlistCount: number;
  isLoggedIn: boolean;
}) {
  const pathname = usePathname();

  const items = [
    { href: "/", label: "হোম", icon: Home },
    { href: "/products", label: "পণ্যসমূহ", icon: LayoutGrid },
    { href: "/cart", label: "কার্ট", icon: ShoppingCart, count: cartCount },
    { href: "/wishlist", label: "পছন্দ", icon: Heart, count: wishlistCount },
    { href: isLoggedIn ? "/account" : "/login", label: "অ্যাকাউন্ট", icon: User },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] ${
              active ? "text-teal-700" : "text-slate-500"
            }`}
          >
            <Icon className="h-5 w-5" />
            {item.label}
            {!!item.count && item.count > 0 && (
              <span className="absolute right-5 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white">
                {toBanglaDigits(item.count)}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
