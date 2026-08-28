"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackageSearch } from "lucide-react";

export function TrackOrderForm() {
  const [orderNumber, setOrderNumber] = useState("");
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const value = orderNumber.trim();
        if (value) {
          router.push(`/my-orders/${encodeURIComponent(value)}`);
        }
      }}
      className="flex flex-col gap-3 sm:flex-row"
    >
      <div className="relative flex-1">
        <PackageSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="অর্ডার নম্বর লিখুন (যেমনঃ MK-XXXXXX)"
          className="h-11 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-sm focus:border-teal-600 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        className="h-11 rounded-xl bg-teal-700 px-5 text-sm font-medium text-white hover:bg-teal-800"
      >
        ট্র্যাক করুন
      </button>
    </form>
  );
}
