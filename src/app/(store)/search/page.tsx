import type { Metadata } from "next";
import { getDistinctBrands, listProducts } from "@/lib/queries/catalog";
import { getCurrentUser } from "@/lib/auth";
import { getWishlistProductIds } from "@/lib/queries/commerce";
import { ProductListingLayout } from "@/components/buyer/ProductListingLayout";

export const metadata: Metadata = { title: "অনুসন্ধান ফলাফল", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const query = sp.q?.trim() ?? "";
  const page = Number(sp.page ?? "1") || 1;

  const [result, brands, user] = await Promise.all([
    listProducts({
      q: query || undefined,
      brand: sp.brand,
      minPrice: sp.minPrice ? Number(sp.minPrice) : undefined,
      maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined,
      discountOnly: sp.discount === "1",
      sort: sp.sort,
      page,
      pageSize: 20,
    }),
    getDistinctBrands(),
    getCurrentUser(),
  ]);

  const wishlistIds = user ? await getWishlistProductIds(user.id) : new Set<number>();

  const buildPageHref = (targetPage: number) => {
    const params = new URLSearchParams(sp as Record<string, string>);
    params.set("page", String(targetPage));
    return `/search?${params.toString()}`;
  };

  return (
    <ProductListingLayout
      title={query ? `"${query}" এর জন্য অনুসন্ধানের ফলাফল` : "অনুসন্ধান"}
      breadcrumb={[{ label: "হোম", href: "/" }, { label: "অনুসন্ধান" }]}
      items={result.items}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      brands={brands}
      wishlistIds={wishlistIds}
      emptyMessage="আপনার অনুসন্ধানের সাথে মিলে এমন কোনো পণ্য পাওয়া যায়নি।"
      buildPageHref={buildPageHref}
    />
  );
}
