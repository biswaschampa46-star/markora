import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogIn } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/buyer/LoginForm";
import { GoogleLoginButton } from "@/components/buyer/GoogleLoginButton";

export const metadata: Metadata = { title: "লগইন", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const [{ redirect: redirectTo }, user] = await Promise.all([searchParams, getCurrentUser()]);

  // Already signed in — always go to /account to avoid redirect loops
  // (e.g. a customer hitting /admin → /login?redirect=/admin → back to /admin).
  if (user) {
    redirect("/account");
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
          <LogIn className="h-6 w-6" />
        </span>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">অ্যাকাউন্টে লগইন করুন</h1>
        <p className="text-sm text-slate-500">অর্ডার করতে ও আপনার তথ্য দেখতে লগইন করুন।</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <GoogleLoginButton redirectTo={redirectTo} />
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-3 text-slate-400">অথবা</span>
          </div>
        </div>
        <LoginForm redirectTo={redirectTo} />
      </div>
    </div>
  );
}
