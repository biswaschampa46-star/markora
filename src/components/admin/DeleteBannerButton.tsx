"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteBannerAction } from "@/actions/admin";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

export function DeleteBannerButton({
  bannerId,
  bannerTitle,
}: {
  bannerId: number;
  bannerTitle: string;
}) {
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

  return (
    <>
      {dialog}
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          confirm({
            title: "ব্যানার মুছে ফেলুন",
            description: `"${bannerTitle}" ব্যানারটি মুছে ফেলতে চান? এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।`,
            danger: true,
            onConfirm: () => {
              startTransition(async () => {
                await deleteBannerAction(bannerId);
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
