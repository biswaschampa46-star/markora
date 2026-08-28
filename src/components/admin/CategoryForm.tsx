"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createCategoryAction, updateCategoryAction } from "@/actions/admin";
import { Button } from "@/components/ui/Button";
import type { categories } from "@/db/schema";

type CategoryRow = typeof categories.$inferSelect;

type Props = {
  category?: CategoryRow;
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

export function CategoryForm({ category, mode = "create" }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(category?.image ?? null);
  const isEdit = mode === "edit" && category;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        const result = isEdit
          ? await updateCategoryAction(formData)
          : await createCategoryAction(formData);
        if (result?.ok) {
          router.push("/admin/categories");
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

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(isEdit ? (category?.image ?? null) : null);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mt-4 flex max-w-2xl flex-col gap-5">
      {isEdit && <input type="hidden" name="categoryId" value={category.id} />}

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="নাম *">
            <input
              name="name"
              required
              defaultValue={category?.name ?? ""}
              placeholder="যেমন: ফ্যাশন"
              className={inputCls}
            />
          </Field>

          <Field label="ক্রম (sort order)">
            <input
              name="sortOrder"
              type="number"
              defaultValue={category?.sortOrder ?? 0}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input
            id="cat-active"
            name="isActive"
            type="checkbox"
            defaultChecked={isEdit ? category.isActive : true}
            className="h-4 w-4 accent-teal-700"
          />
          <label htmlFor="cat-active" className="text-sm text-slate-700">
            সক্রিয় (হোমপেজ ও মেনুতে দেখাবে)
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">ছবি (ঐচ্ছিক)</h2>
        <p className="mt-1 text-xs text-slate-500">Supabase Storage-এ আপলোড করা হবে। সর্বোচ্চ ১০MB।</p>
        <input
          type="file"
          name="image"
          accept="image/*"
          onChange={handleImageChange}
          className={`${inputCls} mt-3 h-auto py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-teal-700 hover:file:bg-teal-100`}
        />
        {imagePreview && (
          <div className="relative mt-3 h-20 w-20 overflow-hidden rounded-full border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => {
                setImagePreview(null);
                const input = formRef.current?.elements.namedItem("image") as HTMLInputElement;
                if (input) input.value = "";
              }}
              className="absolute right-0 top-0 rounded-full bg-white/80 p-0.5 text-red-500 hover:bg-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </section>

      <Button type="submit" loading={isPending} size="lg" className="self-start">
        {isEdit ? "ক্যাটাগরি আপডেট করুন" : "ক্যাটাগরি সংরক্ষণ করুন"}
      </Button>
    </form>
  );
}