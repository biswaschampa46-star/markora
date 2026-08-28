"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CustomSelect } from "@/components/ui/CustomSelect";

const SORT_OPTIONS = [
  { value: "newest", label: "নতুন পণ্য" },
  { value: "popularity", label: "জনপ্রিয়তা" },
  { value: "price_asc", label: "মূল্যঃ কম থেকে বেশি" },
  { value: "price_desc", label: "মূল্যঃ বেশি থেকে কম" },
  { value: "rating", label: "রেটিং" },
  { value: "discount", label: "সর্বোচ্চ ছাড়" },
];

export function ProductFilters({ brands }: { brands: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";
  const brand = searchParams.get("brand") ?? "";
  const sort = searchParams.get("sort") ?? "newest";
  const discountOnly = searchParams.get("discount") === "1";

  const applyParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    params.delete("page");
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const filterBody = (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">মূল্য পরিসীমা</h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="সর্বনিম্ন"
            defaultValue={minPrice}
            onBlur={(e) => applyParams({ minPrice: e.target.value || null })}
            className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
          />
          <span className="text-slate-400">-</span>
          <input
            type="number"
            placeholder="সর্বোচ্চ"
            defaultValue={maxPrice}
            onBlur={(e) => applyParams({ maxPrice: e.target.value || null })}
            className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
          />
        </div>
      </div>

      {brands.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">ব্র্যান্ড</h3>
          <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="radio" name="brand" checked={brand === ""} onChange={() => applyParams({ brand: null })} />
              সকল ব্র্যান্ড
            </label>
            {brands.map((b) => (
              <label key={b} className="flex items-center gap-2 text-sm text-slate-600">
                <input type="radio" name="brand" checked={brand === b} onChange={() => applyParams({ brand: b })} />
                {b}
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={discountOnly}
            onChange={(e) => applyParams({ discount: e.target.checked ? "1" : null })}
          />
          শুধুমাত্র ছাড়যুক্ত পণ্য
        </label>
      </div>

      <Button variant="outline" size="sm" onClick={() => router.push("?")}>
        ফিল্টার মুছুন
      </Button>
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
        >
          <SlidersHorizontal className="h-4 w-4" /> ফিল্টার
        </button>
        <CustomSelect
          name="sort-mobile"
          value={sort}
          onChange={(v) => applyParams({ sort: v })}
          options={SORT_OPTIONS}
          className="h-10"
          ariaLabel="সাজান"
        />
      </div>

      <div className="hidden lg:block">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">ফিল্টার</h2>
          <CustomSelect
            name="sort"
            value={sort}
            onChange={(v) => applyParams({ sort: v })}
            options={SORT_OPTIONS}
            className="h-9"
            ariaLabel="সাজান"
          />
        </div>
        {filterBody}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] overflow-y-auto bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">ফিল্টার</h2>
              <button onClick={() => setOpen(false)} aria-label="বন্ধ করুন">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            {filterBody}
          </div>
        </div>
      )}
    </>
  );
}
