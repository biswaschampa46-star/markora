import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { ProductForm } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

export default async function AdminNewProductPage() {
  const allCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-slate-900">নতুন পণ্য যোগ করুন</h1>
      <ProductForm categories={allCategories} />
    </div>
  );
}
