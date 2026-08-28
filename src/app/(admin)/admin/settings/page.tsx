import type { ReactNode } from "react";
import { updateStoreSettingsAction } from "@/actions/admin";
import { getStoreSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const inputCls =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-teal-600 focus:outline-none";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-teal-700" />
      {label}
    </label>
  );
}

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ saved }, settings] = await Promise.all([searchParams, getStoreSettings()]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-slate-900">স্টোর সেটিংস</h1>

      {saved === "1" && (
        <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          সেটিংস সফলভাবে সংরক্ষণ করা হয়েছে।
        </p>
      )}

      <form action={updateStoreSettingsAction} className="mt-4 flex flex-col gap-5">
        {/* General */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">সাধারণ</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="স্টোরের নাম">
              <input name="storeName" defaultValue={settings?.storeName ?? ""} className={inputCls} />
            </Field>
            <Field label="লোগো URL">
              <input name="logo" defaultValue={settings?.logo ?? ""} placeholder="/logo.png" className={inputCls} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="মেটা বিবরণ (SEO)">
                <input name="metaDescription" defaultValue={settings?.metaDescription ?? ""} className={inputCls} />
              </Field>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">যোগাযোগ</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="ফোন">
              <input name="phone" defaultValue={settings?.phone ?? ""} className={inputCls} />
            </Field>
            <Field label="হোয়াটসঅ্যাপ">
              <input name="whatsapp" defaultValue={settings?.whatsapp ?? ""} className={inputCls} />
            </Field>
            <Field label="ইমেইল">
              <input name="email" defaultValue={settings?.email ?? ""} className={inputCls} />
            </Field>
            <Field label="ফেসবুক লিংক">
              <input name="facebook" defaultValue={settings?.facebook ?? ""} className={inputCls} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="ঠিকানা">
                <input name="address" defaultValue={settings?.address ?? ""} className={inputCls} />
              </Field>
            </div>
          </div>
        </section>

        {/* Delivery */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">ডেলিভারি চার্জ</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="ঢাকার ভেতরে (৳)">
              <input name="insideDhakaFee" type="number" min="0" step="1" defaultValue={settings?.insideDhakaFee ?? ""} className={inputCls} />
            </Field>
            <Field label="ঢাকার বাইরে (৳)">
              <input name="outsideDhakaFee" type="number" min="0" step="1" defaultValue={settings?.outsideDhakaFee ?? ""} className={inputCls} />
            </Field>
            <Field label="ফ্রি ডেলিভারি শুরু (৳)">
              <input name="freeShippingThreshold" type="number" min="0" step="1" defaultValue={settings?.freeShippingThreshold ?? ""} className={inputCls} />
            </Field>
          </div>
        </section>

        {/* Payment */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">পেমেন্ট পদ্ধতি</h2>
          <div className="mt-3 flex flex-col gap-3 text-sm">
            <Toggle name="codEnabled" label="ক্যাশ অন ডেলিভারি (COD)" defaultChecked={settings?.codEnabled ?? true} />
            <div className="flex flex-wrap items-center gap-3">
              <Toggle name="bkashEnabled" label="বিকাশ" defaultChecked={settings?.bkashEnabled ?? false} />
              <input
                name="bkashNumber"
                defaultValue={settings?.bkashNumber ?? ""}
                placeholder="বিকাশ নম্বর"
                className={`${inputCls} h-9 w-44`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Toggle name="nagadEnabled" label="নগদ" defaultChecked={settings?.nagadEnabled ?? false} />
              <input
                name="nagadNumber"
                defaultValue={settings?.nagadNumber ?? ""}
                placeholder="নগদ নম্বর"
                className={`${inputCls} h-9 w-44`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Toggle name="rocketEnabled" label="রকেট" defaultChecked={settings?.rocketEnabled ?? false} />
              <input
                name="rocketNumber"
                defaultValue={settings?.rocketNumber ?? ""}
                placeholder="রকেট নম্বর"
                className={`${inputCls} h-9 w-44`}
              />
            </div>
          </div>
        </section>

        {/* Danger zone */}
        <section className="rounded-xl border border-red-200 bg-red-50/50 p-5">
          <h2 className="text-sm font-semibold text-red-800">মেইনটেন্যান্স মোড</h2>
          <p className="mt-1 text-xs text-red-700/80">
            চালু করলে সাধারণ গ্রাহকরা স্টোর দেখতে পাবেন না; শুধু অ্যাডমিনরা দেখতে পারবেন।
          </p>
          <div className="mt-2">
            <Toggle name="maintenanceMode" label="মেইনটেন্যান্স মোড চালু" defaultChecked={settings?.maintenanceMode ?? false} />
          </div>
        </section>

        <button
          type="submit"
          className="self-start rounded-xl bg-teal-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-teal-800"
        >
          সংরক্ষণ করুন
        </button>
      </form>
    </div>
  );
}
