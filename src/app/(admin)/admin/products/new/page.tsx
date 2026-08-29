import { db } from "@/db";
import { categories } from "@/db/schema";
import { asc } from "drizzle-orm";
import { ProductForm } from "@/components/admin/ProductForm";
import type { CategoryRow } from "@/lib/queries/catalog";

export const dynamic = "force-dynamic";

export default async function AdminNewProductPage() {
  // Load ALL categories (active + inactive) — an admin must be able to assign
  // any category to a product, even one that is currently hidden from the store.
  const allCategories: CategoryRow[] = await db
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-slate-900">নতুন পণ্য যোগ করুন</h1>
      <ProductForm categories={allCategories} />
    </div>
  );
}
