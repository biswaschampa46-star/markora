import { BannerForm } from "@/components/admin/BannerForm";

export const dynamic = "force-dynamic";

export default function AdminBannerNewPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-slate-900">নতুন ব্যানার যোগ করুন</h1>
      <BannerForm mode="create" />
    </div>
  );
}
