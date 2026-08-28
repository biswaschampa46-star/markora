import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata: Metadata = { robots: { index: false } };

// Auth pages live outside the (store) group so they remain reachable even while
// maintenance mode is on — otherwise admins could never sign in to turn it off.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8fa]">
      <header className="border-b border-slate-200 bg-white py-3">
        <div className="mx-auto max-w-md px-4">
          <Link href="/" className="text-xl font-bold text-teal-800">
            মার্কোরা
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center">{children}</main>
    </div>
  );
}
