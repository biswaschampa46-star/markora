import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { getFlashSaleById } from "@/actions/admin";
import { FlashSaleForm } from "@/components/admin/FlashSaleForm";

export const dynamic = "force-dynamic";

export default async function AdminFlashSaleEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sale = await getFlashSaleById(Number(id));
  if (!sale) notFound();

  const allProducts = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(asc(products.name));

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-slate-900">ফ্ল্যাশ সেল সম্পাদনা</h1>
      <FlashSaleForm products={allProducts} sale={sale} />
    </div>
  );
}