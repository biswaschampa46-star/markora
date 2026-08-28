import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { FlashSaleForm } from "@/components/admin/FlashSaleForm";

export const dynamic = "force-dynamic";

export default async function AdminFlashSaleNewPage() {
  const allProducts = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(asc(products.name));

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-slate-900">নতুন ফ্ল্যাশ সেল</h1>
      <FlashSaleForm products={allProducts} />
    </div>
  );
}