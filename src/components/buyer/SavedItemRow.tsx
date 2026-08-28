"use client";

import Image from "next/image";
import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageOff, ShoppingCart, Trash2 } from "lucide-react";
import { moveToSavedAction, removeCartItemAction } from "@/actions/cart";
import { useToast } from "@/components/providers/ToastProvider";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PriceDisplay } from "@/components/ui/PriceDisplay";

export type SavedItemView = {
  id: number;
  stockAvailable: number;
  priceInfo: { price: number; originalPrice: number | null };
  product: {
    name: string;
    slug: string;
    thumbnail: string | null;
    isActive: boolean;
    hasVariants: boolean;
  };
};

export function SavedItemRow({ item }: { item: SavedItemView }) {
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();

  const moveToCart = () => {
    startTransition(async () => {
      const result = await moveToSavedAction(item.id, false);
      showToast(result.message, result.ok ? "success" : "error");
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

  const outOfStock = item.stockAvailable <= 0 || !item.product.isActive;

  return (
    <div className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0">
      {dialog}
      <Link href={`/products/${item.product.slug}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
        {item.product.thumbnail ? (
          <Image src={item.product.thumbnail} alt={item.product.name} fill sizes="64px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <ImageOff className="h-5 w-5" />
          </div>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/products/${item.product.slug}`} className="line-clamp-1 text-sm font-medium text-slate-800 hover:text-teal-700">
          {item.product.name}
        </Link>
        {outOfStock && <span className="text-xs text-red-600">স্টক শেষ</span>}
        <PriceDisplay price={item.priceInfo.price} originalPrice={item.priceInfo.originalPrice} size="sm" />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          disabled={isPending || outOfStock}
          onClick={moveToCart}
          title={outOfStock ? undefined : "কার্টে ফিরিয়ে আনুন"}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal-700 px-3 text-xs font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShoppingCart className="h-3.5 w-3.5" /> কার্টে আনুন
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            confirm({
              title: "সংরক্ষিত পণ্যটি মুছে ফেলতে চান?",
              danger: true,
              onConfirm: remove,
            })
          }
          aria-label="মুছে ফেলুন"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
