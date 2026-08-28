"use client";

import { useSyncExternalStore } from "react";
import { toBanglaDigits } from "@/lib/format";

/** Seconds left until `endTime`, floored at 0. */
function secondsUntil(endTime: string): number {
  const diff = new Date(endTime).getTime() - Date.now();
  return diff <= 0 ? 0 : Math.floor(diff / 1000);
}

/**
 * Ticking countdown to a flash sale's end time.
 *
 * Driven through `useSyncExternalStore` rather than `useState` + an effect that
 * seeds itself: the interval is the external source of truth, so there is no
 * synchronous setState during mount and no extra cascading render per tick.
 * The server snapshot is 0, so SSR and the first client paint agree.
 */
export function FlashSaleCountdown({ endTime }: { endTime: string }) {
  const remainingSeconds = useSyncExternalStore(
    (onChange) => {
      const id = setInterval(onChange, 1000);
      return () => clearInterval(id);
    },
    () => secondsUntil(endTime),
    () => 0,
  );

  if (remainingSeconds <= 0) {
    return <span className="text-sm font-medium text-white">সময় শেষ হয়ে গেছে</span>;
  }

  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds / 60) % 60);
  const seconds = remainingSeconds % 60;
  const pad = (n: number) => toBanglaDigits(n.toString().padStart(2, "0"));

  return (
    <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-white">
      <span className="rounded bg-black/25 px-2 py-1">{pad(hours)}</span>:
      <span className="rounded bg-black/25 px-2 py-1">{pad(minutes)}</span>:
      <span className="rounded bg-black/25 px-2 py-1">{pad(seconds)}</span>
    </div>
  );
}
