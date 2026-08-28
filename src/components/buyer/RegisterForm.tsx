"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction, type AuthState } from "@/actions/auth";
import { Button } from "@/components/ui/Button";

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(registerAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">পূর্ণ নাম</label>
        <input name="name" required className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="আপনার নাম লিখুন" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">ইমেইল</label>
        <input name="email" type="email" required className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="example@email.com" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">মোবাইল নম্বর</label>
        <input name="phone" required className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="017XXXXXXXX" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">পাসওয়ার্ড</label>
        <input name="password" type="password" required className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড" />
      </div>
      {state?.error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
      <Button type="submit" fullWidth loading={isPending}>অ্যাকাউন্ট তৈরি করুন</Button>
      <p className="text-center text-sm text-slate-500">
        ইতিমধ্যে অ্যাকাউন্ট আছে? <Link href="/login" className="font-medium text-teal-700">লগইন করুন</Link>
      </p>
    </form>
  );
}
