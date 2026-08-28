import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toBanglaDigits } from "@/lib/format";

export function Pagination({
  currentPage,
  totalPages,
  buildHref,
}: {
  currentPage: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let p = start; p <= end; p++) pages.push(p);

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="পেজিনেশন">
      <Link
        href={buildHref(Math.max(1, currentPage - 1))}
        aria-disabled={currentPage === 1}
        className={`flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 ${currentPage === 1 ? "pointer-events-none text-slate-300" : "text-slate-600 hover:bg-slate-100"}`}
      >
        <ChevronRight className="h-4 w-4 rotate-180" />
      </Link>
      {start > 1 && <span className="px-2 text-slate-400">…</span>}
      {pages.map((p) => (
        <Link
          key={p}
          href={buildHref(p)}
          className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium ${
            p === currentPage ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {toBanglaDigits(p)}
        </Link>
      ))}
      {end < totalPages && <span className="px-2 text-slate-400">…</span>}
      <Link
        href={buildHref(Math.min(totalPages, currentPage + 1))}
        aria-disabled={currentPage === totalPages}
        className={`flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 ${currentPage === totalPages ? "pointer-events-none text-slate-300" : "text-slate-600 hover:bg-slate-100"}`}
      >
        <ChevronLeft className="h-4 w-4 rotate-180" />
      </Link>
    </nav>
  );
}
