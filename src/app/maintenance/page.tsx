import { Wrench } from "lucide-react";
import { getStoreSettings } from "@/lib/settings";
import { redirect } from "next/navigation";

export default async function MaintenancePage() {
  const settings = await getStoreSettings();
  if (!settings?.maintenanceMode) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-teal-700">
        <Wrench className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900">সাইটটি রক্ষণাবেক্ষণের কাজ চলছে</h1>
      <p className="max-w-md text-sm text-slate-600">
        আমরা বর্তমানে সাইটের উন্নয়নমূলক কাজ করছি। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।
      </p>
      {settings?.phone && <p className="text-sm text-slate-500">জরুরি প্রয়োজনে যোগাযোগ করুনঃ {settings.phone}</p>}
    </div>
  );
}
