import Link from "next/link";
import Image from "next/image";
import { ImageOff, Plus, Search } from "lucide-react";
import { listAdminProducts } from "@/actions/products";
import { Badge } from "@/components/ui/Badge";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { DeleteProductButton } from "@/components/admin/DeleteProductButton";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const page = Number(sp.page ?? "1") || 1;
  const result = await listAdminProducts(q || undefined, page);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">পণ্যসমূহ</h1>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800"
        >
          <Plus className="h-4 w-4" />
          নতুন পণ্য যোগ করুন
        </Link>
      </div>

      {/* Search */}
      <form className="mt-4" method="get">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="পণ্য খুঁজুন..."
            className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm focus:border-teal-600 focus:outline-none"
          />
        </div>
      </form>

      <p className="mt-3 text-sm text-slate-500">
        মোট {result.total} টি পণ্য
        {q && ` · "${q}" অনুযায়ী`}
      </p>

      {/* Product table */}
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
            <tr>
              <th className="px-4 py-3">ছবি</th>
              <th className="px-4 py-3">নাম</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">মূল্য</th>
              <th className="px-4 py-3">স্টক</th>
              <th className="px-4 py-3">স্ট্যাটাস</th>
              <th className="px-4 py-3 text-right">কার্যক্রম</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  {q ? "কোনো পণ্য পাওয়া যায়নি।" : "এখনও কোনো পণ্য যোগ করা হয়নি।"}
                </td>
              </tr>
            ) : (
              result.items.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-slate-100">
                      {p.thumbnail ? (
                        <Image src={p.thumbnail} alt={p.name} fill sizes="40px" className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300">
                          <ImageOff className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/products/${p.id}`} className="font-medium text-slate-800 hover:text-teal-700">
                      {p.name}
                    </Link>
                    {p.brand && <p className="text-xs text-slate-400">{p.brand}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.sku}</td>
                  <td className="px-4 py-3">
                    <PriceDisplay
                      price={Number(p.discountPrice ?? p.basePrice)}
                      originalPrice={p.discountPrice ? Number(p.basePrice) : undefined}
                      size="sm"
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.stock}</td>
                  <td className="px-4 py-3">
                    {p.isActive ? (
                      <Badge tone="success">সক্রিয়</Badge>
                    ) : (
                      <Badge tone="neutral">নিষ্ক্রিয়</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        সম্পাদনা
                      </Link>
                      <DeleteProductButton productId={p.id} productName={p.name} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {result.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {Array.from({ length: result.totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/products?q=${encodeURIComponent(q)}&page=${p}`}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium ${
                p === result.page
                  ? "bg-teal-700 text-white"
                  : "border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
