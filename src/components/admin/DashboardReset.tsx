"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { resetDashboardDataFormAction } from "@/actions/admin";

/**
 * Danger-zone control for wiping all demo/test transactional data
 * (orders, reviews, notifications). Requires typing RESET to enable.
 */
export function DashboardReset() {
  const [confirmText, setConfirmText] = useState("");
  const armed = confirmText.trim() === "RESET";

  return (
    <details className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-red-800">
        <TriangleAlert className="h-4 w-4" />
        ড্যাশবোর্ড রিসেট (ডেমো ডেটা মুছুন)
      </summary>
      <div className="mt-3 text-sm text-red-900">
        <p>
          এতে <strong>সব অর্ডার, অর্ডার আইটেম, ডেলিভারি পেমেন্ট, পর্যালোচনা ও নোটিফিকেশন</strong> স্থায়ীভাবে মুছে
          যাবে। পণ্য, ক্যাটাগরি, ইউজার ও সেটিংস অপরিবর্তিত থাকবে। এই কাজ আর ফেরানো যাবে না।
        </p>
        <form action={resetDashboardDataFormAction} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="confirm" value={armed ? "RESET" : ""} />
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="নিশ্চিত হতে RESET লিখুন"
            className="h-9 w-56 rounded-lg border border-red-300 bg-white px-3 text-sm"
          />
          <button
            type="submit"
            disabled={!armed}
            onClick={(e) => {
              if (!window.confirm("আপনি কি নিশ্চিত? সব অর্ডার ও রিভিউ মুছে যাবে!")) e.preventDefault();
            }}
            className="h-9 rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            রিসেট করুন
          </button>
        </form>
      </div>
    </details>
  );
}