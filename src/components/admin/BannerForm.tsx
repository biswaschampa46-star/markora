"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createBannerAction, updateBannerAction } from "@/actions/admin";
import { Button } from "@/components/ui/Button";
import { CustomSelect } from "@/components/ui/CustomSelect";
import type { banners } from "@/db/schema";

type BannerRow = typeof banners.$inferSelect;

type Props = {
  banner?: BannerRow;
  mode?: "create" | "edit";
};

const inputCls =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-teal-600 focus:outline-none";

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export function BannerForm({ banner, mode = "create" }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(banner?.image ?? null);
  const [mobilePreview, setMobilePreview] = useState<string | null>(banner?.mobileImage ?? null);
  const isEdit = mode === "edit" && banner;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        const result = isEdit
          ? await updateBannerAction(formData)
          : await createBannerAction(formData);
        if (result?.ok) {
          router.push("/admin/banners");
          router.refresh();
        } else {
          setError(result?.message ?? "একটি ত্রুটি ঘটেছে।");
        }
      } catch (err) {
        setError(
          `সার্ভারের সাথে সংযোগ করা যায়নি: ${(err as Error).message ?? "অজানা ত্রুটি"}। পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।`,
        );
      }
    });
  }

  function handleImageChange(
    e: React.ChangeEvent<HTMLInputElement>,
    setPreview: (v: string | null) => void,
  ) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mt-4 flex flex-col gap-5">
      {isEdit && <input type="hidden" name="bannerId" value={banner.id} />}

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      {/* Basic Info */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">মৌলিক তথ্য</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="শিরোনাম">
            <input
              name="title"
              defaultValue={banner?.title ?? ""}
              placeholder="যেমন: জিড মেগা ছাড়!"
              className={inputCls}
            />
          </Field>

          <Field label="উপশিরোনাম">
            <input
              name="subtitle"
              defaultValue={banner?.subtitle ?? ""}
              placeholder="যেমন: সিলেটের গভীরে 80% পর্যন্ত ছাড়"
              className={inputCls}
            />
          </Field>

          <Field label="সেকশন">
            <CustomSelect
              name="section"
              defaultValue={banner?.section ?? "hero"}
              options={[
                { value: "hero", label: "হিরো (হোমপেজ উপরের স্লাইডার)" },
                { value: "promo", label: "প্রোমো (হোমপেজ নিচের প্রোমো ব্যানার)" },
              ]}
              className={inputCls}
            />
          </Field>

          <Field label="লিংক (ঐচ্ছিক)">
            <input
              name="link"
              defaultValue={banner?.link ?? ""}
              placeholder="যেমন: /products/mega-sale"
              className={inputCls}
            />
          </Field>

          <Field label="সাজানোর ক্রম">
            <input
              name="sortOrder"
              type="number"
              min="0"
              defaultValue={banner?.sortOrder ?? 0}
              className={inputCls}
            />
          </Field>

          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={banner?.isActive ?? true}
                className="h-4 w-4 accent-teal-700"
              />
              সক্রিয়
            </label>
          </div>

          <Field label="শুরুর তারিখ (ঐচ্ছিক)">
            <input
              name="startDate"
              type="date"
              defaultValue={banner?.startDate ? new Date(banner.startDate).toISOString().split("T")[0] : ""}
              className={inputCls}
            />
          </Field>

          <Field label="শেষের তারিখ (ঐচ্ছিক)">
            <input
              name="endDate"
              type="date"
              defaultValue={banner?.endDate ? new Date(banner.endDate).toISOString().split("T")[0] : ""}
              className={inputCls}
            />
          </Field>
        </div>
      </section>

      {/* Images */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">ছবি</h2>
        <p className="mt-1 text-xs text-slate-500">Supabase Storage-এ আপলোড করা হবে।</p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={isEdit ? "ডেস্কটপ ছবি (নতুন দিলে পুরোনোটি মুছে যাবে)" : "ডেস্কটপ ছবি *"}>
            <input
              type="file"
              name="image"
              accept="image/*"
              onChange={(e) => handleImageChange(e, setImagePreview)}
              className={`${inputCls} h-auto py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-teal-700 hover:file:bg-teal-100`}
            />
            {imagePreview && (
              <div className="relative mt-2 aspect-[16/7] w-full max-w-sm overflow-hidden rounded-lg border border-slate-200">
                <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null);
                    const input = formRef.current?.elements.namedItem("image") as HTMLInputElement;
                    if (input) input.value = "";
                  }}
                  className="absolute right-1 top-1 rounded-full bg-white/80 p-1 text-red-500 hover:bg-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </Field>

          <Field label="মোবাইল ছবি (ঐচ্ছিক, ডেস্কটপ ছবির পরিবর্তে)">
            <input
              type="file"
              name="mobileImage"
              accept="image/*"
              onChange={(e) => handleImageChange(e, setMobilePreview)}
              className={`${inputCls} h-auto py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-teal-700 hover:file:bg-teal-100`}
            />
            {mobilePreview && (
              <div className="relative mt-2 aspect-[9/16] w-32 overflow-hidden rounded-lg border border-slate-200">
                <img src={mobilePreview} alt="Mobile preview" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setMobilePreview(null);
                    const input = formRef.current?.elements.namedItem("mobileImage") as HTMLInputElement;
                    if (input) input.value = "";
                  }}
                  className="absolute right-1 top-1 rounded-full bg-white/80 p-1 text-red-500 hover:bg-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </Field>
        </div>
      </section>

      <Button type="submit" loading={isPending} size="lg" className="self-start">
        {isEdit ? "ব্যানার আপডেট করুন" : "ব্যানার সংরক্ষণ করুন"}
      </Button>
    </form>
  );
}
