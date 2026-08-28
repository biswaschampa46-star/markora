import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ProductFilters } from "@/components/buyer/ProductFilters";
import { ProductGrid } from "@/components/buyer/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { toBanglaDigits } from "@/lib/format";
import type { ProductRow } from "@/lib/queries/catalog";

export function ProductListingLayout({
  title,
  breadcrumb,
  items,
  total,
  page,
  totalPages,
  brands,
  wishlistIds,
  emptyMessage,
  buildPageHref,
}: {
  title: string;
  breadcrumb: { label: string; href?: string }[];
  items: ProductRow[];
  total: number;
  page: number;
  totalPages: number;
  brands: string[];
  wishlistIds: Set<number>;
  emptyMessage: string;
  buildPageHref: (page: number) => string;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Breadcrumb items={breadcrumb} />
      <h1 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{toBanglaDigits(total)} টি পণ্য পাওয়া গেছে</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        <aside>
          <ProductFilters brands={brands} />
        </aside>
        <div>
          {items.length === 0 ? (
            <EmptyState title={emptyMessage} />
          ) : (
            <>
              <ProductGrid products={items} wishlistIds={wishlistIds} />
              <div className="mt-8">
                <Pagination currentPage={page} totalPages={totalPages} buildHref={buildPageHref} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
