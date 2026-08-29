import { notFound } from "next/navigation";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { ProductForm } from "@/components/admin/ProductForm";
import type { CategoryRow } from "@/lib/queries/catalog";

export const dynamic = "force-dynamic";

export default async function AdminEditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = Number(id);
  if (!productId) notFound();

  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!product) notFound();

  const allCategories: CategoryRow[] = await db
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-slate-900">পণ্য সম্পাদনা</h1>
      <p className="mt-1 text-sm text-slate-500">
        {product.name} ({product.sku})
      </p>
      <ProductForm categories={allCategories} product={product} mode="edit" />
    </div>
  );
}
