import { BadgeCheck } from "lucide-react";

/**
 * Markora Verified Buyer badge — shown once a buyer has completed
 * VERIFIED_BUYER_THRESHOLD orders that genuinely reached "delivered".
 * Presentational only; the verified state always comes from the server.
 */
export function VerifiedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="Verified Markora Buyer — 3টি সফল অর্ডার সম্পন্ন হয়েছে"
      className={`inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700 ring-1 ring-teal-200 ${className}`}
    >
      <BadgeCheck className="h-3.5 w-3.5" />
      Verified Buyer
    </span>
  );
}
