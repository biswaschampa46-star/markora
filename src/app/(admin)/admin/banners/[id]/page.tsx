import { notFound } from "next/navigation";
import { getBannerById } from "@/actions/admin";
import { BannerForm } from "@/components/admin/BannerForm";

export const dynamic = "force-dynamic";

export default async function AdminBannerEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const banner = await getBannerById(Number(id));
  if (!banner) notFound();

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-slate-900">ব্যানার সম্পাদনা</h1>
      <BannerForm banner={banner} mode="edit" />
    </div>
  );
}
