import { CategoryForm } from "@/components/admin/CategoryForm";

export const dynamic = "force-dynamic";

export default function AdminCategoryNewPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-slate-900">নতুন ক্যাটাগরি যোগ করুন</h1>
      <CategoryForm mode="create" />
    </div>
  );
}