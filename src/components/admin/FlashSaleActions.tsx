"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteFlashSaleAction, toggleFlashSaleAction } from "@/actions/admin";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

export function DeleteFlashSaleButton({
  saleId,
  saleTitle,
}: {
  saleId: number;
  saleTitle: string;
}) {
  const [isPending, startTransition] = useTransition();
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
            title: "ফ্ল্যাশ সেল মুছে ফেলুন",
            description: `"${saleTitle}" ফ্ল্যাশ সেলটি এবং এর সব পণ্য মুছে ফেলতে চান? এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।`,
            danger: true,
            onConfirm: () => {
              startTransition(async () => {
                await deleteFlashSaleAction(saleId);
                router.refresh();
              });
            },
          })
        }
        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2 className="h-3 w-3" />
        {isPending ? "মুছছে..." : "মুছুন"}
      </button>
    </>
  );
}

export function ToggleFlashSaleButton({
  saleId,
  isActive,
}: {
  saleId: number;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await toggleFlashSaleAction(saleId);
          router.refresh();
        })
      }
      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      {isPending ? "..." : isActive ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}
    </button>
  );
}