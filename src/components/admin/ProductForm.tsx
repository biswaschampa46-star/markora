"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { X } from "lucide-react";
import { createProductAction, updateProductAction, removeProductImageAction } from "@/actions/products";
import { Button } from "@/components/ui/Button";
import { CustomSelect } from "@/components/ui/CustomSelect";
import type { CategoryRow } from "@/lib/queries/catalog";
import type { ProductRow } from "@/lib/queries/catalog";

type Props = {
  categories: CategoryRow[];
  product?: ProductRow;
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

export function ProductForm({ categories, product, mode = "create" }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(product?.thumbnail ?? null);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    product?.categoryId ? String(product.categoryId) : "",
  );
  const isEdit = mode === "edit" && product;

  // Size inputs only make sense for apparel — shown when the selected category
  // is (or is named like) "Fashion".
  const selectedCategory = categories.find((c) => String(c.id) === selectedCategoryId);
  const isFashionCategory = (() => {
    let cat = selectedCategory;
    while (cat) {
      const hay = `${cat.name} ${cat.slug}`.toLowerCase();
      if (hay.includes("fashion") || cat.name.includes("ফ্যাশন")) return true;
      cat = categories.find((c) => c.id === cat!.parentId);
    }
    return false;
  })();

  const SIZE_PRESETS = ["S", "M", "L", "XL", "XXL", "3XL"];
  function appendSizePreset(value: string) {
    const input = formRef.current?.elements.namedItem("sizes") as HTMLInputElement | null;
    if (!input) return;
    const current = input.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (current.some((s) => s.toLowerCase() === value.toLowerCase())) return;
    input.value = [...current, value].join(", ");
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const action = isEdit
        ? updateProductAction.bind(null, null)
        : createProductAction.bind(null, null);
      const result = await action(formData);
      if (!result?.ok) {
        setError(result?.message ?? "একটি ত্রুটি ঘটেছে।");
      }
    });
  }

  function handleThumbChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setThumbPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setThumbPreview(null);
    }
  }

  function handleImagesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const selected = Array.from(files);
    setImageFiles(selected);
    const previews: string[] = [];
    for (const file of selected) {
      const reader = new FileReader();
      reader.onload = () => {
        previews.push(reader.result as string);
        if (previews.length === selected.length) setImagePreviews([...previews]);
      };
      reader.readAsDataURL(file);
    }
  }

  // Remove a selected image: drops it from preview state AND rewrites the
  // file input's FileList so the removed file is not submitted.
  function removeImage(index: number) {
    const nextFiles = imageFiles.filter((_, i) => i !== index);
    setImageFiles(nextFiles);
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    const input = formRef.current?.elements.namedItem("images") as HTMLInputElement | null;
    if (input) {
      const dt = new DataTransfer();
      nextFiles.forEach((f) => dt.items.add(f));
      input.files = dt.files;
    }
  }

  // Auto-generate slug from name
  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mt-4 flex flex-col gap-5">
      {isEdit && <input type="hidden" name="productId" value={product.id} />}
      {isEdit && <input type="hidden" name="existingThumbnail" value={product.thumbnail ?? ""} />}

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      {/* Basic Info */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">মৌলিক তথ্য</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="পণ্যের নাম *" className="sm:col-span-2">
            <input
              name="name"
              defaultValue={product?.name ?? ""}
              required
              className={inputCls}
              onChange={(e) => {
                const slugField = formRef.current?.elements.namedItem("slug") as HTMLInputElement;
                if (slugField && !isEdit) slugField.value = generateSlug(e.target.value);
              }}
            />
          </Field>

          <Field label="স্লাগ (URL) *">
            <input name="slug" defaultValue={product?.slug ?? ""} required className={inputCls} />
          </Field>

          <Field label="ব্র্যান্ড">
            <input name="brand" defaultValue={product?.brand ?? ""} className={inputCls} />
          </Field>

          <Field label="ক্যাটাগরি">
            <CustomSelect
              name="categoryId"
              value={selectedCategoryId}
              onChange={(v) => setSelectedCategoryId(v)}
              options={[
                { value: "", label: "-- ক্যাটাগরি নির্বাচন করুন --" },
                ...categories.map((cat) => ({
                  value: String(cat.id),
                  label: cat.isActive ? cat.name : `${cat.name} (নিষ্ক্রিয়)`,
                })),
              ]}
              className={inputCls}
            />
          </Field>

          <Field label="SKU *">
            <input name="sku" defaultValue={product?.sku ?? ""} required className={inputCls} />
          </Field>

          <Field label="বারকোড">
            <input name="barcode" defaultValue={product?.barcode ?? ""} className={inputCls} />
          </Field>

          <Field label="ওজন (গ্রাম)">
            <input
              name="weight"
              type="number"
              min="0"
              defaultValue={product?.weight ?? ""}
              className={inputCls}
            />
          </Field>

          <Field label="ওয়ারেন্টি">
            <input
              name="warranty"
              defaultValue={product?.warranty ?? ""}
              placeholder="যেমন: ১ বছর"
              className={inputCls}
            />
          </Field>

          <Field label="অবস্থা">
            <CustomSelect
              name="condition"
              defaultValue={product?.condition ?? "new"}
              options={[
                { value: "new", label: "নতুন" },
                { value: "used", label: "ব্যবহৃত" },
                { value: "refurbished", label: "রিফারবিশড" },
              ]}
              className={inputCls}
            />
          </Field>

          <Field label="ট্যাগ (কমা দিয়ে আলাদা)">
            <input
              name="tags"
              defaultValue={product?.tags?.join(", ") ?? ""}
              placeholder="যেমন: ইলেকট্রনিকস, মোবাইল"
              className={inputCls}
            />
          </Field>
        </div>
      </section>

      {/* Description */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">বিবরণ</h2>
        <div className="mt-3 flex flex-col gap-4">
          <Field label="সংক্ষিপ্ত বিবরণ">
            <textarea
              name="shortDescription"
              defaultValue={product?.shortDescription ?? ""}
              rows={2}
              className={`${inputCls} h-auto py-2`}
            />
          </Field>
          <Field label="বিস্তারিত বিবরণ">
            <textarea
              name="description"
              defaultValue={product?.description ?? ""}
              rows={6}
              className={`${inputCls} h-auto py-2`}
            />
          </Field>
        </div>
      </section>

      {/* Pricing & Stock */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">মূল্য ও স্টক</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="মূল্য (৳) *">
            <input
              name="basePrice"
              type="number"
              min="0"
              step="0.01"
              required
              defaultValue={product?.basePrice ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="ছাড়ের মূল্য (৳)">
            <input
              name="discountPrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue={product?.discountPrice ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="স্টক">
            <input
              name="stock"
              type="number"
              min="0"
              defaultValue={product?.stock ?? 0}
              className={inputCls}
            />
          </Field>
          <Field label="কম স্টক সতর্কতা">
            <input
              name="lowStockThreshold"
              type="number"
              min="0"
              defaultValue={product?.lowStockThreshold ?? 5}
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
          <Field label="থাম্বনেইল ছবি">
            <input
              type="file"
              name="thumbnail"
              accept="image/*"
              onChange={handleThumbChange}
              className={`${inputCls} h-auto py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-teal-700 hover:file:bg-teal-100`}
            />
            {thumbPreview && (
              <div className="relative mt-2 h-24 w-24 overflow-hidden rounded-lg border border-slate-200">
                <img src={thumbPreview} alt="Preview" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setThumbPreview(null);
                    const input = formRef.current?.elements.namedItem("thumbnail") as HTMLInputElement;
                    if (input) input.value = "";
                  }}
                  className="absolute right-0.5 top-0.5 rounded-full bg-white/80 p-0.5 text-red-500 hover:bg-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </Field>

          <Field label="অতিরিক্ত ছবি (একাধিক বাছাই করুন)">
            <input
              type="file"
              name="images"
              accept="image/*"
              multiple
              onChange={handleImagesChange}
              className={`${inputCls} h-auto py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-teal-700 hover:file:bg-teal-100`}
            />
            {imagePreviews.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200">
                    <img src={src} alt={`Preview ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      aria-label={`ছবি ${i + 1} সরান`}
                      className="absolute right-0.5 top-0.5 rounded-full bg-white/90 p-0.5 text-red-500 shadow-sm hover:bg-red-50"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Field>

          <Field label="ভিডিও URL (ঐচ্ছিক)">
            <input
              name="videoUrl"
              defaultValue={product?.videoUrl ?? ""}
              placeholder="YouTube বা অন্য ভিডিও লিংক"
              className={inputCls}
            />
          </Field>
        </div>

        {/* Show existing images in edit mode — each with a red remove button */}
        {isEdit && product.images.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-slate-600">বিদ্যমান ছবি:</p>
            <div className="flex flex-wrap gap-2">
              {product.images.map((img, i) => (
                <div key={i} className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200">
                  <img src={img.url} alt={img.alt ?? ""} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    aria-label="ছবি মুছে ফেলুন"
                    disabled={isPending}
                    onClick={() => {
                      if (!confirm("এই ছবিটি স্থায়ীভাবে মুছে ফেলবেন?")) return;
                      startTransition(async () => {
                        const result = await removeProductImageAction(product.id, img.url);
                        if (!result?.ok) setError(result?.message ?? "ছবি মুছে ফেলা যায়নি।");
                      });
                    }}
                    className="absolute right-0.5 top-0.5 rounded-full bg-red-500 p-1 text-white shadow-sm transition-colors hover:bg-red-600 disabled:opacity-50"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Options */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">অপশন</h2>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2 text-slate-700">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={product?.isActive ?? true}
              className="h-4 w-4 accent-teal-700"
            />
            সক্রিয়
          </label>
          <label className="flex items-center gap-2 text-slate-700">
            <input
              type="checkbox"
              name="isFeatured"
              defaultChecked={product?.isFeatured ?? false}
              className="h-4 w-4 accent-teal-700"
            />
            ফিচার্ড
          </label>
          <label className="flex items-center gap-2 text-slate-700">
            <input
              type="checkbox"
              name="returnEligible"
              defaultChecked={product?.returnEligible ?? true}
              className="h-4 w-4 accent-teal-700"
            />
            রিটার্নযোগ্য
          </label>
          <label className="flex items-center gap-2 text-slate-700">
            <input
              type="checkbox"
              name="hasVariants"
              defaultChecked={product?.hasVariants ?? false}
              className="h-4 w-4 accent-teal-700"
            />
            ভ্যারিয়েন্ট আছে
          </label>
        </div>
      </section>

      {/* Sizes — only for Fashion categories */}
      {isFashionCategory && (
        <section className="rounded-xl border border-teal-200 bg-teal-50/50 p-5">
          <h2 className="text-sm font-semibold text-slate-900">সাইজ (Fashion)</h2>
          <p className="mt-1 text-xs text-slate-500">
            ক্রেতা এই সাইজগুলো থেকে বাছাই করবে। কমা দিয়ে আলাদা করুন, যেমন: S, M, L, XL
          </p>
          <div className="mt-3 flex flex-col gap-3">
            <input
              name="sizes"
              defaultValue={product?.sizes?.join(", ") ?? ""}
              placeholder="S, M, L, XL"
              className={inputCls}
            />
            <div className="flex flex-wrap gap-2">
              {SIZE_PRESETS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => appendSizePreset(s)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-teal-600 hover:text-teal-700"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* SEO */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">SEO</h2>
        <div className="mt-3 flex flex-col gap-4">
          <Field label="SEO শিরোনাম">
            <input
              name="seoTitle"
              defaultValue={product?.seoTitle ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="SEO বিবরণ">
            <textarea
              name="seoDescription"
              defaultValue={product?.seoDescription ?? ""}
              rows={2}
              className={`${inputCls} h-auto py-2`}
            />
          </Field>
        </div>
      </section>

      <Button type="submit" loading={isPending} size="lg" className="self-start">
        {isEdit ? "পণ্য আপডেট করুন" : "পণ্য সংরক্ষণ করুন"}
      </Button>
    </form>
  );
}
