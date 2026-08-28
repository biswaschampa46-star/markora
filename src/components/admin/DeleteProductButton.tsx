"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteProductAction } from "@/actions/products";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

export function DeleteProductButton({
  productId,
  productName,
}: {
  productId: number;
  productName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

  return (
    <>
      {dialog}
      <button
        disabled={isPending}
        onClick={() =>
          confirm({
            title: "পণ্য মুছে ফেলুন",
            description: `"${productName}" মুছে ফেলতে চান? এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।`,
            danger: true,
            onConfirm: () => {
              startTransition(async () => {
                await deleteProductAction(productId);
              });
            },
          })
        }
        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        মুছুন
      </button>
    </>
  );
}
