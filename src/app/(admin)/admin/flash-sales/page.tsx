import Link from "next/link";
import { Plus, Zap } from "lucide-react";
import { listFlashSales } from "@/actions/admin";
import { Badge } from "@/components/ui/Badge";
import {
  DeleteFlashSaleButton,
  ToggleFlashSaleButton,
} from "@/components/admin/FlashSaleActions";

export const dynamic = "force-dynamic";

function saleStatus(start: Date, end: Date, isActive: boolean) {
  const now = new Date();
  if (!isActive) return <Badge tone="neutral">নিষ্ক্রিয়</Badge>;
  if (now < start) return <Badge tone="info">শুরু হবে</Badge>;
  if (now > end) return <Badge tone="neutral">শেষ হয়েছে</Badge>;
  return <Badge tone="success">চলমান</Badge>;
}

export default async function AdminFlashSalesPage() {
  const sales = await listFlashSales();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Zap className="h-5 w-5 text-orange-500" />
          ফ্ল্যাশ সেল
        </h1>
        <Link
          href="/admin/flash-sales/new"
          className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800"
        >
          <Plus className="h-4 w-4" />
          নতুন ফ্ল্যাশ সেল
        </Link>
      </div>

      <p className="mt-3 text-sm text-slate-500">
        হোমপেজের ফ্ল্যাশ সেল ব্যানার ও কাউন্টডাউন এখান থেকে নিয়ন্ত্রিত হয়। মোট {sales.length} টি।
      </p>

      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
            <tr>
              <th className="px-4 py-3">শিরোনাম</th>
              <th className="px-4 py-3">সময়কাল</th>
              <th className="px-4 py-3">পণ্য</th>
              <th className="px-4 py-3">স্ট্যাটাস</th>
              <th className="px-4 py-3 text-right">কার্যক্রম</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sales.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  এখনও কোনো ফ্ল্যাশ সেল তৈরি করা হয়নি।
                </td>
              </tr>
            ) : (
              sales.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/flash-sales/${s.id}`} className="font-medium text-slate-800 hover:text-teal-700">
                      {s.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(s.startTime).toLocaleString("bn-BD")}
                    {" → "}
                    {new Date(s.endTime).toLocaleString("bn-BD")}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.itemCount} টি</td>
                  <td className="px-4 py-3">{saleStatus(s.startTime, s.endTime, s.isActive)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <ToggleFlashSaleButton saleId={s.id} isActive={s.isActive} />
                      <Link
                        href={`/admin/flash-sales/${s.id}`}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        সম্পাদনা
                      </Link>
                      <DeleteFlashSaleButton saleId={s.id} saleTitle={s.title} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}