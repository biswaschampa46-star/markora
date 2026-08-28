import { Star } from "lucide-react";

export function RatingStars({
  rating,
  size = 16,
  showValue = false,
}: {
  rating: number;
  size?: number;
  showValue?: boolean;
}) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <div className="flex items-center gap-1" role="img" aria-label={`রেটিং ৫ এর মধ্যে ${rating}`}>
      <div className="flex items-center">
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i + 1 <= rounded;
          const half = !filled && i + 0.5 === rounded;
          return (
            <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
              <Star
                width={size}
                height={size}
                className="absolute inset-0 text-slate-300"
                fill="currentColor"
              />
              {(filled || half) && (
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: half ? "50%" : "100%" }}
                >
                  <Star width={size} height={size} className="text-amber-400" fill="currentColor" />
                </span>
              )}
            </span>
          );
        })}
      </div>
      {showValue && <span className="text-sm font-medium text-slate-700">{rating.toFixed(1)}</span>}
    </div>
  );
}
