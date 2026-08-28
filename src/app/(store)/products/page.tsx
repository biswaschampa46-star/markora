import type { Metadata } from "next";
import { listProducts, getDistinctBrands } from "@/lib/queries/catalog";
import { getCurrentUser } from "@/lib/auth";
import { getWishlistProductIds } from "@/lib/queries/commerce";
import { ProductListingLayout } from "@/components/buyer/ProductListingLayout";

export const metadata: Metadata = {
  title: "সকল পণ্য",
  description: "আমাদের সকল পণ্যের সংগ্রহ দেখুন।",
};

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;

  const [result, brands, user] = await Promise.all([
    listProducts({
      q: sp.q,
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
    return `/products?${params.toString()}`;
  };

  return (
    <ProductListingLayout
      title="সকল পণ্য"
      breadcrumb={[{ label: "হোম", href: "/" }, { label: "সকল পণ্য" }]}
      items={result.items}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      brands={brands}
      wishlistIds={wishlistIds}
      emptyMessage="এই মুহূর্তে কোনো পণ্য পাওয়া যায়নি।"
      buildPageHref={buildPageHref}
    />
  );
}
