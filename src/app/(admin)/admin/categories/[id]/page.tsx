import { notFound } from "next/navigation";
import { getCategoryById } from "@/actions/admin";
import { CategoryForm } from "@/components/admin/CategoryForm";

export const dynamic = "force-dynamic";

export default async function AdminCategoryEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const category = await getCategoryById(Number(id));
  if (!category) notFound();

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-slate-900">ক্যাটাগরি সম্পাদনা</h1>
      <CategoryForm category={category} mode="edit" />
    </div>
  );
}