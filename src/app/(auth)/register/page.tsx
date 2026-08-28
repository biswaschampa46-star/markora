import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { RegisterForm } from "@/components/buyer/RegisterForm";
import { GoogleLoginButton } from "@/components/buyer/GoogleLoginButton";

export const metadata: Metadata = { title: "অ্যাকাউন্ট তৈরি করুন", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/account");

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
          <UserPlus className="h-6 w-6" />
        </span>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">নতুন অ্যাকাউন্ট তৈরি করুন</h1>
        <p className="text-sm text-slate-500">মাত্র কয়েক সেকেন্ডেই শপিং শুরু করুন।</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <GoogleLoginButton />
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-3 text-slate-400">অথবা</span>
          </div>
        </div>
        <RegisterForm />
      </div>
    </div>
  );
}
