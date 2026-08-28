"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { markAllNotificationsReadAction } from "@/actions/notifications";
import { toBanglaDigits } from "@/lib/format";
import type { NotificationItem } from "@/lib/queries/notifications";

/**
 * Bell icon + unread badge + dropdown feed. Purely presentational —
 * data is fetched by the server wrapper and passed in as props.
 */
export function NotificationBellClient({
  items,
  unreadCount,
  scope,
  align = "right",
}: {
  items: NotificationItem[];
  unreadCount: number;
  scope: "admin" | "customer";
  /** Which edge the dropdown anchors to. Sidebar bell → "left" (opens into content). */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="নোটিফিকেশন"
        className="relative flex items-center rounded-lg p-2 text-slate-600 hover:bg-slate-100"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
            {unreadCount > 9 ? "৯+" : toBanglaDigits(unreadCount)}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-slate-900">নোটিফিকেশন</span>
            {unreadCount > 0 && (
              <form action={markAllNotificationsReadAction}>
                <input type="hidden" name="scope" value={scope} />
                <button
                  type="submit"
                  className="flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> সব পড়া হয়েছে
                </button>
              </form>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">কোনো নোটিফিকেশন নেই।</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((n) => {
                const content = (
                  <div className={`px-4 py-3 ${n.isRead ? "" : "bg-teal-50/60"}`}>
                    <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
                      {!n.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-teal-600" />}
                      {n.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.message}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {toBanglaDigits(
                        new Date(n.createdAt).toLocaleString("bn-BD", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                      )}
                    </p>
                  </div>
                );
                return (
                  <li key={n.id} className="border-b border-slate-50 last:border-0">
                    {n.link ? (
                      <Link href={n.link} onClick={() => setOpen(false)} className="block hover:bg-slate-50">
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}