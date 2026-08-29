import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import type { StoreSettings } from "@/lib/settings";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.6.8-.8 1-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4 0-.5.1-.7l.4-.5c.1-.2.1-.3 0-.5-.1-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.8 2.8 4.4 3.9.6.3 1.1.4 1.5.6.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.4-.3Z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-8h2.7l.4-3.2h-3.1V7.7c0-.9.3-1.6 1.6-1.6h1.7V3.2C16.5 3.1 15.4 3 14.2 3c-2.6 0-4.4 1.6-4.4 4.5v2.3H7v3.2h2.8v8h3.7Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Footer({ settings }: { settings: StoreSettings | null }) {
  const hasContact = Boolean(settings?.phone || settings?.email || settings?.address || settings?.whatsapp);
  const hasSocial = Boolean(settings?.facebook || settings?.instagram || settings?.whatsapp);

  return (
    <footer className="mt-16 border-t border-slate-200 bg-slate-950 text-slate-300">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div>
          <h3 className="text-lg font-bold text-white">{settings?.storeName || "মার্কোরা"}</h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            {settings?.metaDescription || "বাংলাদেশের বিশ্বস্ত অনলাইন শপিং প্ল্যাটফর্ম।"}
          </p>
          {hasSocial && (
            <div className="mt-4 flex gap-3">
              {settings?.facebook && (
                <a href={settings.facebook} target="_blank" rel="noreferrer" aria-label="ফেসবুক" className="rounded-full bg-slate-800 p-2 hover:bg-slate-700">
                  <FacebookIcon />
                </a>
              )}
              {settings?.whatsapp && (
                <a
                  href={`https://wa.me/${settings.whatsapp.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="হোয়াটসঅ্যাপ"
                  className="rounded-full bg-slate-800 p-2 hover:bg-slate-700"
                >
                  <WhatsAppIcon />
                </a>
              )}
              {settings?.instagram && (
                <a href={settings.instagram} target="_blank" rel="noreferrer" aria-label="ইনস্টাগ্রাম" className="rounded-full bg-slate-800 p-2 hover:bg-slate-700">
                  <InstagramIcon />
                </a>
              )}
            </div>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400">গুরুত্বপূর্ণ পাতা</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/about" className="hover:text-white">আমাদের সম্পর্কে</Link></li>
            <li><Link href="/faq" className="hover:text-white">প্রায়শই জিজ্ঞাসিত প্রশ্ন</Link></li>
            <li><Link href="/contact" className="hover:text-white">যোগাযোগ</Link></li>
            <li><Link href="/my-orders" className="hover:text-white">অর্ডার ট্র্যাক করুন</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400">নীতিমালা</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/terms" className="hover:text-white">শর্তাবলি</Link></li>
            <li><Link href="/privacy" className="hover:text-white">গোপনীয়তা নীতি</Link></li>
            <li><Link href="/return-policy" className="hover:text-white">রিটার্ন নীতি</Link></li>
            <li><Link href="/refund-policy" className="hover:text-white">রিফান্ড নীতি</Link></li>
            <li><Link href="/shipping-policy" className="hover:text-white">ডেলিভারি নীতি</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400">যোগাযোগের তথ্য</h4>
          {hasContact ? (
            <ul className="mt-3 space-y-2 text-sm">
              {settings?.phone && (
                <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-500" />{settings.phone}</li>
              )}
              {settings?.whatsapp && (
                <li className="flex items-center gap-2">
                  <WhatsAppIcon />
                  <a
                    href={`https://wa.me/${settings.whatsapp.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white"
                  >
                    {settings.whatsapp}
                  </a>
                </li>
              )}
              {settings?.email && (
                <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-500" />{settings.email}</li>
              )}
              {settings?.address && (
                <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />{settings.address}</li>
              )}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">যোগাযোগের তথ্য এখনও সেট করা হয়নি।</p>
          )}
        </div>
      </div>

      <div className="border-t border-slate-800 px-4 py-4 text-center text-xs text-slate-500 sm:px-6">
        © {new Date().getFullYear()} {settings?.storeName || "মার্কোরা"} — সর্বস্বত্ব সংরক্ষিত।
      </div>
    </footer>
  );
}
