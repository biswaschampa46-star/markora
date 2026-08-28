"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toggleWishlistAction } from "@/actions/wishlist";
import { useToast } from "@/components/providers/ToastProvider";

export function WishlistButton({
  productId,
  active,
  variant = "icon",
}: {
  productId: number;
  active?: boolean;
  variant?: "icon" | "labeled";
}) {
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const router = useRouter();

  const handleClick = () => {
    startTransition(async () => {
      const result = await toggleWishlistAction(productId);
      showToast(result.message, result.ok ? "success" : "error");
      if (result.requireLogin) {
        router.push("/login");
        return;
      }
      router.refresh();
    });
  };

  if (variant === "labeled") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        <Heart className={`h-4 w-4 ${active ? "fill-red-500 text-red-500" : "text-slate-500"}`} />
        {active ? "পছন্দের তালিকায় আছে" : "পছন্দের তালিকায় যোগ করুন"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={active ? "পছন্দের তালিকা থেকে সরান" : "পছন্দের তালিকায় যোগ করুন"}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-sm hover:text-red-500 disabled:opacity-60"
    >
      <Heart className={`h-4 w-4 ${active ? "fill-red-500 text-red-500" : ""}`} />
    </button>
  );
}
