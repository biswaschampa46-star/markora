"use client";

import Image from "next/image";
import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, ImageOff, Minus, Plus, Trash2 } from "lucide-react";
import { moveToSavedAction, removeCartItemAction, updateCartQuantityAction } from "@/actions/cart";
import { useToast } from "@/components/providers/ToastProvider";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { Badge } from "@/components/ui/Badge";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

export type CartItemView = {
  id: number;
  quantity: number;
  isAvailable: boolean;
  stockAvailable: number;
  lineTotal: number;
  priceInfo: { price: number; originalPrice: number | null };
  product: { name: string; slug: string; thumbnail: string | null };
  variant: { name: string } | null;
};

export function CartItemRow({ item }: { item: CartItemView }) {
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();

  const updateQty = (quantity: number) => {
    if (quantity < 1) return;
    startTransition(async () => {
      const result = await updateCartQuantityAction(item.id, quantity);
      if (!result.ok) showToast(result.message, "error");
      router.refresh();
    });
  };

  const remove = () => {
    startTransition(async () => {
      const result = await removeCartItemAction(item.id);
      showToast(result.message, result.ok ? "success" : "error");
      router.refresh();
    });
  };

  const saveForLater = () => {
    startTransition(async () => {
      const result = await moveToSavedAction(item.id, true);
      showToast(result.message, result.ok ? "success" : "error");
      router.refresh();
    });
  };

  return (
    <div className="flex gap-3 border-b border-slate-100 py-4 last:border-0">
      {dialog}
      <Link href={`/products/${item.product.slug}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
        {item.product.thumbnail ? (
          <Image src={item.product.thumbnail} alt={item.product.name} fill sizes="80px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <ImageOff className="h-6 w-6" />
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1">
        <Link href={`/products/${item.product.slug}`} className="line-clamp-2 text-sm font-medium text-slate-800 hover:text-teal-700">
          {item.product.name}
        </Link>
        {item.variant && <span className="text-xs text-slate-500">{item.variant.name}</span>}
        {!item.isAvailable && <Badge tone="danger">স্টক শেষ</Badge>}
        <PriceDisplay price={item.priceInfo.price} originalPrice={item.priceInfo.originalPrice} size="sm" />
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center rounded-lg border border-slate-300">
            <button
              type="button"
              disabled={isPending}
              onClick={() => updateQty(item.quantity - 1)}
              className="flex h-8 w-8 items-center justify-center text-slate-600"
              aria-label="কমান"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-8 text-center text-sm">{item.quantity}</span>
            <button
              type="button"
              disabled={isPending || item.quantity >= item.stockAvailable}
              onClick={() => updateQty(item.quantity + 1)}
              className="flex h-8 w-8 items-center justify-center text-slate-600 disabled:opacity-40"
              aria-label="বাড়ান"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isPending}
              onClick={saveForLater}
              className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-teal-700 disabled:opacity-50"
            >
              <BookmarkPlus className="h-3.5 w-3.5" /> পরে কিনব
            </button>
            <button
              type="button"
              onClick={() =>
                confirm({
                  title: "পণ্যটি কার্ট থেকে সরাতে চান?",
                  danger: true,
                  onConfirm: remove,
                })
              }
              className="flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
            >
              <Trash2 className="h-3.5 w-3.5" /> মুছে ফেলুন
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
