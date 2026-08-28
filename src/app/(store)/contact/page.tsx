import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { InfoPage } from "@/components/buyer/InfoPage";
import { getStoreSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "যোগাযোগ",
  description: "যেকোনো প্রশ্ন বা অভিযোগের জন্য আমাদের সাথে যোগাযোগ করুন।",
};

export default async function ContactPage() {
  const settings = await getStoreSettings();
  const hasAny = Boolean(settings?.phone || settings?.email || settings?.address || settings?.whatsapp || settings?.facebook);

  return (
    <InfoPage title="যোগাযোগ">
      <p>
        পণ্য, অর্ডার বা ডেলিভারি সংক্রান্ত যেকোনো প্রশ্নে আমাদের সাথে যোগাযোগ করুন। আমরা সাধারণত
        সকাল ৯টা থেকে রাত ১০টা পর্যন্ত উত্তর দিই।
      </p>

      {hasAny ? (
        <ul className="flex flex-col gap-3 [&_li]:ml-0 [&_li]:list-none [&_ul]:space-y-3">
          {settings?.phone && (
            <li className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <Phone className="h-4 w-4 shrink-0 text-teal-700" />
              <a href={`tel:${settings.phone}`}>{settings.phone}</a>
            </li>
          )}
          {settings?.whatsapp && (
            <li className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <MessageCircle className="h-4 w-4 shrink-0 text-teal-700" />
              <a href={`https://wa.me/${settings.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer">
                হোয়াটসঅ্যাপ: {settings.whatsapp}
              </a>
            </li>
          )}
          {settings?.facebook && (
            <li className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-teal-700" fill="currentColor" aria-hidden="true">
                <path d="M13.5 21v-8h2.7l.4-3.2h-3.1V7.7c0-.9.3-1.6 1.6-1.6h1.7V3.2C16.5 3.1 15.4 3 14.2 3c-2.6 0-4.4 1.6-4.4 4.5v2.3H7v3.2h2.8v8h3.7Z" />
              </svg>
              <a href={settings.facebook} target="_blank" rel="noreferrer">
                ফেসবুক পেজ
              </a>
            </li>
          )}
          {settings?.email && (
            <li className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <Mail className="h-4 w-4 shrink-0 text-teal-700" />
              <a href={`mailto:${settings.email}`}>{settings.email}</a>
            </li>
          )}
          {settings?.address && (
            <li className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
              <span>{settings.address}</span>
            </li>
          )}
        </ul>
      ) : (
        <p>যোগাযোগের তথ্য এখনও যুক্ত করা হয়নি — শীঘ্রই এখানে যুক্ত করা হবে।</p>
      )}

      <h2>অর্ডার সংক্রান্ত সহায়তা</h2>
      <p>
        অর্ডারের স্ট্যাটাস জানতে <Link href="/my-orders">আমার অর্ডার</Link> পেজ থেকে আপনার অর্ডার
        নম্বর দিয়ে ট্র্যাক করতে পারেন।
      </p>
    </InfoPage>
  );
}
