"use client";

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { AddToCartButton } from "@/components/buyer/AddToCartButton";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { Badge } from "@/components/ui/Badge";
import { computePrice, availableStock } from "@/lib/pricing";

type Variant = {
  id: number;
  name: string;
  attributes: Record<string, string>;
  price: string;
  discountPrice: string | null;
  stock: number;
  reservedStock: number;
  isActive: boolean;
};

export function VariantSelector({
  productId,
  variants,
  sizes = [],
  fallbackPrice,
  fallbackOriginalPrice,
  fallbackStock,
}: {
  productId: number;
  variants: Variant[];
  /** Fixed sizes (e.g. Fashion) the buyer must choose from. */
  sizes?: string[];
  fallbackPrice: number;
  fallbackOriginalPrice: number | null;
  fallbackStock: number;
}) {
  const attributeGroups = useMemo(() => {
    const groups = new Map<string, Set<string>>();
    for (const v of variants) {
      for (const [key, value] of Object.entries(v.attributes)) {
        if (!groups.has(key)) groups.set(key, new Set());
        groups.get(key)!.add(value);
      }
    }
    return Array.from(groups.entries()).map(([key, values]) => ({ key, values: Array.from(values) }));
  }, [variants]);

  const [selected, setSelected] = useState<Record<string, string>>({});
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const matchedVariant = useMemo(() => {
    if (variants.length === 0) return null;
    return (
      variants.find((v) =>
        attributeGroups.every((group) => selected[group.key] === v.attributes[group.key]),
      ) ?? null
    );
  }, [variants, selected, attributeGroups]);

  const hasVariants = variants.length > 0;
  const priceInfo = matchedVariant
    ? computePrice(matchedVariant)
    : { price: fallbackPrice, originalPrice: fallbackOriginalPrice, hasDiscount: false, discountPercent: 0 };
  const stock = matchedVariant
    ? availableStock(matchedVariant.stock, matchedVariant.reservedStock)
    : fallbackStock;

  const allSelected = attributeGroups.every((g) => selected[g.key]);
  const sizeSelected = sizes.length === 0 || Boolean(selectedSize);
  const outOfStock =
    hasVariants || sizes.length > 0
      ? (hasVariants ? allSelected : true) && sizeSelected
        ? stock <= 0
        : false
      : stock <= 0;

  return (
    <div className="flex flex-col gap-4">
      <PriceDisplay price={priceInfo.price} originalPrice={priceInfo.originalPrice} size="lg" />

      {attributeGroups.map((group) => (
        <div key={group.key}>
          <p className="mb-2 text-sm font-medium text-slate-700">{group.key}</p>
          <div className="flex flex-wrap gap-2">
            {group.values.map((value) => {
              const isSelected = selected[group.key] === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelected((prev) => ({ ...prev, [group.key]: value }))}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${
                    isSelected
                      ? "border-teal-700 bg-teal-50 text-teal-800"
                      : "border-slate-300 text-slate-700 hover:border-slate-400"
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {sizes.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">
            সাইজ <span className="text-red-500">*</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((value) => {
              const isSelected = selectedSize === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedSize((prev) => (prev === value ? null : value))}
                  className={`min-w-11 rounded-lg border px-3 py-1.5 text-sm ${
                    isSelected
                      ? "border-teal-700 bg-teal-50 text-teal-800"
                      : "border-slate-300 text-slate-700 hover:border-slate-400"
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        {hasVariants && !allSelected ? (
          <Badge tone="warning">কিনতে সব অপশন নির্বাচন করুন</Badge>
        ) : sizes.length > 0 && !selectedSize ? (
          <Badge tone="warning">কিনতে সাইজ নির্বাচন করুন</Badge>
        ) : stock > 0 ? (
          <Badge tone="success">স্টকে আছে ({stock} টি)</Badge>
        ) : (
          <Badge tone="danger">স্টক শেষ</Badge>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-lg border border-slate-300">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="flex h-10 w-10 items-center justify-center text-slate-600"
            aria-label="কমান"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-sm font-medium">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(stock || 50, q + 1))}
            className="flex h-10 w-10 items-center justify-center text-slate-600"
            aria-label="বাড়ান"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1">
          <AddToCartButton
            productId={productId}
            variantId={matchedVariant?.id ?? null}
            quantity={quantity}
            selectedSize={selectedSize}
            availableSizes={sizes}
            hasVariants={hasVariants}
            disabled={outOfStock || (hasVariants && !allSelected) || (sizes.length > 0 && !selectedSize)}
            fullWidth
          />
        </div>
      </div>
    </div>
  );
}
