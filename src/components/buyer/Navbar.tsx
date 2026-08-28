"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Heart, Menu, ShoppingCart, User, X } from "lucide-react";
import { SearchBar } from "@/components/buyer/SearchBar";
import { toBanglaDigits } from "@/lib/format";
import type { CategoryRow } from "@/lib/queries/catalog";

type NavCategory = CategoryRow & { children: CategoryRow[] };

export function Navbar({
  storeName,
  logo,
  cartCount,
  wishlistCount,
  isLoggedIn,
  categories,
  notificationSlot,
}: {
  storeName: string;
  logo: string | null;
  cartCount: number;
  wishlistCount: number;
  isLoggedIn: boolean;
  categories: NavCategory[];
  notificationSlot?: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          onClick={() => setMenuOpen(true)}
          aria-label="মেনু খুলুন"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link href="/" className="flex shrink-0 items-center gap-2">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={storeName}
              className="h-9 w-auto drop-shadow-[0_2px_5px_rgba(13,148,136,0.55)]"
            />
          ) : (
            <span className="text-xl font-bold text-teal-800">{storeName}</span>
          )}
        </Link>

        <div className="hidden flex-1 lg:block">
          <SearchBar />
        </div>

        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          <Link href="/wishlist" className="relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            <Heart className="h-5 w-5" />
            পছন্দের তালিকা
            {wishlistCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                {toBanglaDigits(wishlistCount)}
              </span>
            )}
          </Link>
          <Link href="/cart" className="relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            <ShoppingCart className="h-5 w-5" />
            কার্ট
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-teal-700 text-[10px] font-bold text-white">
                {toBanglaDigits(cartCount)}
              </span>
            )}
          </Link>
          {notificationSlot}
          <Link
            href={isLoggedIn ? "/account" : "/login"}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <User className="h-5 w-5" />
            {isLoggedIn ? "আমার অ্যাকাউন্ট" : "লগইন"}
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-1 lg:hidden">
          <Link href="/cart" className="relative rounded-lg p-2 text-slate-700">
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-teal-700 text-[9px] font-bold text-white">
                {toBanglaDigits(cartCount)}
              </span>
            )}
          </Link>
        </div>
      </div>

      <div className="border-t border-slate-100 px-4 py-2 lg:hidden">
        <SearchBar />
      </div>

      <div className="hidden border-t border-slate-100 bg-slate-50 lg:block">
        <div className="mx-auto flex max-w-7xl items-center gap-5 overflow-x-auto px-6 py-2 text-sm">
          <Link href="/products" className="whitespace-nowrap font-medium text-slate-700 hover:text-teal-700">
            সকল পণ্য
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/category/${cat.slug}`}
              className="whitespace-nowrap text-slate-600 hover:text-teal-700"
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-72 flex-col bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-slate-900">মেনু</span>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="বন্ধ করুন">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <nav className="mt-4 flex flex-col gap-1">
              <Link href="/" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                হোম
              </Link>
              <Link href="/products" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                সকল পণ্য
              </Link>
              {isLoggedIn && (
                <div className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700">
                  <span>নোটিফিকেশন</span>
                  {notificationSlot}
                </div>
              )}
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug}`}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100"
                >
                  {cat.name}
                </Link>
              ))}
              <div className="my-2 border-t border-slate-100" />
              <Link href="/wishlist" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                পছন্দের তালিকা
              </Link>
              <Link href={isLoggedIn ? "/account" : "/login"} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                {isLoggedIn ? "আমার অ্যাকাউন্ট" : "লগইন / রেজিস্ট্রেশন"}
              </Link>
              <Link href="/contact" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100">
                যোগাযোগ
              </Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
