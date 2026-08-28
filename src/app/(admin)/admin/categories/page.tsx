import Link from "next/link";
import Image from "next/image";
import { ImageOff, Plus } from "lucide-react";
import { listCategories } from "@/actions/admin";
import { Badge } from "@/components/ui/Badge";
import {
  DeleteCategoryButton,
  ToggleCategoryActiveButton,
} from "@/components/admin/CategoryActions";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const cats = await listCategories();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">ক্যাটাগরিসমূহ</h1>
        <Link
          href="/admin/categories/new"
          className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800"
        >
          <Plus className="h-4 w-4" />
          নতুন ক্যাটাগরি যোগ করুন
        </Link>
      </div>

      <p className="mt-3 text-sm text-slate-500">
        মোট {cats.length} টি ক্যাটাগরি — এগুলো হোমপেজের &quot;ক্যাটাগরি অনুযায়ী কিনুন&quot; সেকশনে দেখানো হয়।
      </p>

      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
            <tr>
              <th className="px-4 py-3">ছবি</th>
              <th className="px-4 py-3">নাম</th>
              <th className="px-4 py-3">স্লাগ</th>
              <th className="px-4 py-3">ক্রম</th>
              <th className="px-4 py-3">স্ট্যাটাস</th>
              <th className="px-4 py-3 text-right">কার্যক্রম</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cats.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  এখনও কোনো ক্যাটাগরি যোগ করা হয়নি।
                </td>
              </tr>
            ) : (
              cats.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="relative h-10 w-10 overflow-hidden rounded-full bg-slate-100">
                      {c.image ? (
                        <Image src={c.image} alt={c.name} fill sizes="40px" className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300">
                          <ImageOff className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/categories/${c.id}`} className="font-medium text-slate-800 hover:text-teal-700">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{c.slug}</td>
                  <td className="px-4 py-3 text-slate-600">{c.sortOrder}</td>
                  <td className="px-4 py-3">
                    {c.isActive ? (
                      <Badge tone="success">সক্রিয়</Badge>
                    ) : (
                      <Badge tone="neutral">নিষ্ক্রিয়</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <ToggleCategoryActiveButton categoryId={c.id} isActive={c.isActive} />
                      <Link
                        href={`/admin/categories/${c.id}`}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        সম্পাদনা
                      </Link>
                      <DeleteCategoryButton categoryId={c.id} categoryName={c.name} />
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