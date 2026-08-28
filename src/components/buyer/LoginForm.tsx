"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type AuthState } from "@/actions/auth";
import { Button } from "@/components/ui/Button";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(loginAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">ইমেইল</label>
        <input name="email" type="email" required className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="example@email.com" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">পাসওয়ার্ড</label>
        <input name="password" type="password" required className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="পাসওয়ার্ড লিখুন" />
      </div>
      {state?.error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
      <Button type="submit" fullWidth loading={isPending}>লগইন করুন</Button>
      <p className="text-center text-sm text-slate-500">
        নতুন গ্রাহক? <Link href="/register" className="font-medium text-teal-700">অ্যাকাউন্ট তৈরি করুন</Link>
      </p>
    </form>
  );
}
