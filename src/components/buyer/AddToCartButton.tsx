"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { addToCartAction } from "@/actions/cart";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/Button";

export function AddToCartButton({
  productId,
  variantId = null,
  quantity = 1,
  selectedSize = null,
  availableSizes,
  disabled,
  hasVariants,
  size = "md",
  fullWidth,
  label = "কার্টে যোগ করুন",
}: {
  productId: number;
  variantId?: number | null;
  quantity?: number;
  /** Selected product size (Fashion items). */
  selectedSize?: string | null;
  /** Available sizes — when non-empty a size must be chosen first. */
  availableSizes?: string[];
  disabled?: boolean;
  hasVariants?: boolean;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  label?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const router = useRouter();

  const requiresSize = Boolean(availableSizes && availableSizes.length > 0);

  const handleClick = () => {
    if (hasVariants && !variantId) {
      showToast("অনুগ্রহ করে একটি ভ্যারিয়েন্ট নির্বাচন করুন।", "error");
      return;
    }
    if (requiresSize && !selectedSize) {
      showToast("অনুগ্রহ করে একটি সাইজ নির্বাচন করুন।", "error");
      return;
    }
    startTransition(async () => {
      const result = await addToCartAction(productId, variantId, quantity, requiresSize ? selectedSize : null);
      showToast(result.message, result.ok ? "success" : "error");
      if (result.requireLogin) {
        router.push("/login");
        return;
      }
      if (result.ok) {
        router.refresh();
      }
    });
  };

  return (
    <Button
      type="button"
      size={size}
      fullWidth={fullWidth}
      variant="primary"
      loading={isPending}
      disabled={disabled}
      onClick={handleClick}
    >
      <ShoppingCart className="h-4 w-4" aria-hidden="true" />
      {disabled ? "স্টক শেষ" : label}
    </Button>
  );
}
