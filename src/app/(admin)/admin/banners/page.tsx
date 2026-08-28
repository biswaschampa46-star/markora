import Link from "next/link";
import Image from "next/image";
import { ImageOff, Plus } from "lucide-react";
import { listBanners } from "@/actions/admin";
import { Badge } from "@/components/ui/Badge";
import { DeleteBannerButton } from "@/components/admin/DeleteBannerButton";

export const dynamic = "force-dynamic";

export default async function AdminBannersPage() {
  const banners = await listBanners();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">ব্যানারসমূহ</h1>
        <Link
          href="/admin/banners/new"
          className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800"
        >
          <Plus className="h-4 w-4" />
          নতুন ব্যানার যোগ করুন
        </Link>
      </div>

      <p className="mt-3 text-sm text-slate-500">
        মোট {banners.length} টি ব্যানার
      </p>

      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
            <tr>
              <th className="px-4 py-3">ছবি</th>
              <th className="px-4 py-3">শিরোনাম</th>
              <th className="px-4 py-3">সেকশন</th>
              <th className="px-4 py-3">ক্রম</th>
              <th className="px-4 py-3">স্ট্যাটাস</th>
              <th className="px-4 py-3">সময়কাল</th>
              <th className="px-4 py-3 text-right">কার্যক্রম</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {banners.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  এখনও কোনো ব্যানার যোগ করা হয়নি।
                </td>
              </tr>
            ) : (
              banners.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="relative h-12 w-24 overflow-hidden rounded-lg bg-slate-100">
                      {b.image ? (
                        <Image src={b.image} alt={b.title ?? "ব্যানার"} fill sizes="96px" className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300">
                          <ImageOff className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/banners/${b.id}`} className="font-medium text-slate-800 hover:text-teal-700">
                      {b.title || "(শিরোনাহীন)"}
                    </Link>
                    {b.subtitle && <p className="text-xs text-slate-400 line-clamp-1">{b.subtitle}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={b.section === "hero" ? "info" : "brand"}>
                      {b.section === "hero" ? "হিরো" : "প্রোমো"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{b.sortOrder}</td>
                  <td className="px-4 py-3">
                    {b.isActive ? (
                      <Badge tone="success">সক্রিয়</Badge>
                    ) : (
                      <Badge tone="neutral">নিষ্ক্রিয়</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {b.startDate ? new Date(b.startDate).toLocaleDateString("bn-BD") : "—"}
                    {" → "}
                    {b.endDate ? new Date(b.endDate).toLocaleDateString("bn-BD") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/banners/${b.id}`}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        সম্পাদনা
                      </Link>
                      <DeleteBannerButton bannerId={b.id} bannerTitle={b.title ?? "ব্যানার"} />
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
