import { formatBDT } from "@/lib/format";

export function PriceDisplay({
  price,
  originalPrice,
  size = "md",
}: {
  price: number | null;
  originalPrice?: number | null;
  size?: "sm" | "md" | "lg";
}) {
  if (price === null) {
    return <span className="text-sm text-slate-500">মূল্য নির্ধারণ করা হয়নি।</span>;
  }

  const priceClass = size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg";

  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className={`font-bold text-slate-900 ${priceClass}`}>{formatBDT(price)}</span>
      {originalPrice && originalPrice > price && (
        <span className="text-sm text-slate-400 line-through">{formatBDT(originalPrice)}</span>
      )}
    </div>
  );
}
