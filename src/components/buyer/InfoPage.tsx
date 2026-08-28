import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

export function InfoPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Breadcrumb items={[{ label: "হোম", href: "/" }, { label: title }]} />
      <h1 className="mt-4 text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
      {updated && <p className="mt-1 text-xs text-slate-400">সর্বশেষ হালনাগাদ: {updated}</p>}
      <div className="prose-sm mt-5 flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700 sm:p-7 [&_a]:font-medium [&_a]:text-teal-700 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-900 [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </div>
  );
}
