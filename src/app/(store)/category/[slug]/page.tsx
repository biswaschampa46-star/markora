import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategoryBySlug, getDistinctBrands, listProducts } from "@/lib/queries/catalog";
import { getCurrentUser } from "@/lib/auth";
import { getWishlistProductIds } from "@/lib/queries/commerce";
import { ProductListingLayout } from "@/components/buyer/ProductListingLayout";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "ক্যাটাগরি পাওয়া যায়নি" };
  return { title: category.name, description: `${category.name} বিভাগের সকল পণ্য দেখুন।` };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const category = await getCategoryBySlug(slug);
  if (!category || !category.isActive) notFound();

  const page = Number(sp.page ?? "1") || 1;

  const [result, brands, user] = await Promise.all([
    listProducts({
      categorySlug: slug,
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
    return `/category/${slug}?${params.toString()}`;
  };

  return (
    <ProductListingLayout
      title={category.name}
      breadcrumb={[{ label: "হোম", href: "/" }, { label: category.name }]}
      items={result.items}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      brands={brands}
      wishlistIds={wishlistIds}
      emptyMessage="এই বিভাগে এখনও কোনো পণ্য যোগ করা হয়নি।"
      buildPageHref={buildPageHref}
    />
  );
}
