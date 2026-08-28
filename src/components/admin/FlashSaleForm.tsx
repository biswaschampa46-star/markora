"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createFlashSaleAction, updateFlashSaleAction } from "@/actions/admin";
import { Button } from "@/components/ui/Button";

type ProductOption = { id: number; name: string };

type ItemRow = {
  key: number;
  productId: string;
  discountPrice: string;
  stockLimit: string;
};

type Props = {
  products: ProductOption[];
  sale?: {
    id: number;
    title: string;
    startTime: Date | string;
    endTime: Date | string;
    isActive: boolean;
    items: { productId: number; discountPrice: string; stockLimit: number }[];
  };
};

const inputCls =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-teal-600 focus:outline-none";

function toLocalInputValue(d: Date | string): string {
  const date = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

let rowKey = 0;

export function FlashSaleForm({ products, sale }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ItemRow[]>(() =>
    sale?.items.length
      ? sale.items.map((it) => ({
          key: ++rowKey,
          productId: String(it.productId),
          discountPrice: String(it.discountPrice),
          stockLimit: String(it.stockLimit),
        }))
      : [],
  );
  const isEdit = Boolean(sale);

  function updateItem(key: number, patch: Partial<ItemRow>) {
    setItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeItem(key: number) {
    setItems((rows) => rows.filter((r) => r.key !== key));
  }

  function addItem() {
    setItems((rows) => [...rows, { key: ++rowKey, productId: "", discountPrice: "", stockLimit: "10" }]);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload = items.map((it) => ({
      productId: Number(it.productId),
      discountPrice: Number(it.discountPrice),
      stockLimit: Number(it.stockLimit),
    }));
    fd.set("items", JSON.stringify(payload));

    startTransition(async () => {
      try {
        const result = isEdit ? await updateFlashSaleAction(fd) : await createFlashSaleAction(fd);
        if (result?.ok) {
          router.push("/admin/flash-sales");
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

  const usedProductIds = items.map((it) => Number(it.productId)).filter(Boolean);

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex max-w-3xl flex-col gap-5">
      {isEdit && <input type="hidden" name="saleId" value={sale!.id} />}
      <input type="hidden" name="items" value={JSON.stringify(items.map((it) => ({ productId: Number(it.productId), discountPrice: Number(it.discountPrice), stockLimit: Number(it.stockLimit) })))} />

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">মৌলিক তথ্য</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-slate-600">শিরোনাম *</span>
            <input name="title" required defaultValue={sale?.title ?? ""} placeholder="যেমন: ফ্ল্যাশ সেল!" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">শুরুর সময় *</span>
            <input name="startTime" type="datetime-local" required defaultValue={sale ? toLocalInputValue(sale.startTime) : ""} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">শেষের সময় *</span>
            <input name="endTime" type="datetime-local" required defaultValue={sale ? toLocalInputValue(sale.endTime) : ""} className={inputCls} />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <input id="fs-active" name="isActive" type="checkbox" defaultChecked={sale ? sale.isActive : true} className="h-4 w-4 accent-teal-700" />
          <label htmlFor="fs-active" className="text-sm text-slate-700">সক্রিয়</label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">সেলের পণ্যসমূহ</h2>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4" />
            পণ্য যোগ করুন
          </Button>
        </div>
        {items.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">অন্তত একটি পণ্য যোগ করুন।</p>
        )}
        <div className="mt-3 flex flex-col gap-3">
          {items.map((it) => (
            <div key={it.key} className="grid grid-cols-1 items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_140px_120px_40px]">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">পণ্য</span>
                <select value={it.productId} onChange={(e) => updateItem(it.key, { productId: e.target.value })} className={inputCls}>
                  <option value="">-- নির্বাচন করুন --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id} disabled={usedProductIds.includes(p.id) && Number(it.productId) !== p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">সেল মূল্য (৳)</span>
                <input type="number" min="1" step="0.01" value={it.discountPrice} onChange={(e) => updateItem(it.key, { discountPrice: e.target.value })} className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">স্টক লিমিট</span>
                <input type="number" min="0" value={it.stockLimit} onChange={(e) => updateItem(it.key, { stockLimit: e.target.value })} className={inputCls} />
              </label>
              <button type="button" onClick={() => removeItem(it.key)} className="mb-0.5 flex h-10 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50" aria-label="মুছুন">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <Button type="submit" loading={isPending} size="lg" className="self-start">
        {isEdit ? "ফ্ল্যাশ সেল আপডেট করুন" : "ফ্ল্যাশ সেল সংরক্ষণ করুন"}
      </Button>
    </form>
  );
}