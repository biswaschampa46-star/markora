"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { cancelOrderAction } from "@/actions/orders";
import { useToast } from "@/components/providers/ToastProvider";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

export function CancelOrderButton({ orderNumber }: { orderNumber: string }) {
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();

  return (
    <>
      {dialog}
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          confirm({
            title: "অর্ডারটি বাতিল করতে চান?",
            danger: true,
            onConfirm: () => {
              startTransition(async () => {
                const result = await cancelOrderAction(orderNumber);
                showToast(result.message, result.ok ? "success" : "error");
                router.refresh();
              });
            },
          })
        }
        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
      >
        <XCircle className="h-4 w-4" />
        {isPending ? "বাতিল হচ্ছে..." : "অর্ডার বাতিল করুন"}
      </button>
    </>
  );
}
