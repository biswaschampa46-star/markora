"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function useConfirmDialog() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    description?: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  const confirm = (opts: { title: string; description?: string; onConfirm: () => void; danger?: boolean }) => {
    setState({ open: true, ...opts });
  };

  const dialog: ReactNode = state?.open ? (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">{state.title}</h3>
            {state.description && <p className="mt-1 text-sm text-slate-500">{state.description}</p>}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setState(null)}>
            বাতিল করুন
          </Button>
          <Button
            variant={state.danger ? "danger" : "primary"}
            size="sm"
            onClick={() => {
              state.onConfirm();
              setState(null);
            }}
          >
            নিশ্চিত করুন
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
