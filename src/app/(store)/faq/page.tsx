import type { Metadata } from "next";
import { InfoPage } from "@/components/buyer/InfoPage";
import { getStoreSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "প্রায়শই জিজ্ঞাসিত প্রশ্ন",
  description: "অর্ডার, পেমেন্ট ও ডেলিভারি সংক্রান্ত সাধারণ প্রশ্নের উত্তর।",
};

const FAQS: { q: string; a: (fees: { inside: string; outside: string; freeFrom: string | null }) => string }[] = [
  {
    q: "কীভাবে অর্ডার করব?",
    a: () =>
      "পছন্দের পণ্যটি কার্টে যোগ করুন, তারপর চেকআউট পেজে ঠিকানা ও পেমেন্ট পদ্ধতি নির্বাচন করে অর্ডারটি নিশ্চিত করুন।",
  },
  {
    q: "কোন কোন পেমেন্ট পদ্ধতি ব্যবহার করা যাবে?",
    a: () =>
      "ক্যাশ অন ডেলিভারি (COD), বিকাশ, নগদ ও রকেট। মোবাইল ব্যাংকিংয়ে পরিশোধ করলে লেনদেন আইডি (Transaction ID) দিতে হবে।",
  },
  {
    q: "ডেলিভারি চার্জ কত?",
    a: ({ inside, outside, freeFrom }) =>
      `ঢাকার ভেতরে ${inside} টাকা এবং ঢাকার বাইরে ${outside} টাকা।${
        freeFrom ? ` নির্দিষ্ট পরিমাণ (${freeFrom} টাকা) এর বেশি অর্ডারে ডেলিভারি ফ্রি।` : ""
      }`,
  },
  {
    q: "ডেলিভারিতে কত সময় লাগে?",
    a: () => "ঢাকার ভেতরে সাধারণত ১-২ কর্মদিবস এবং ঢাকার বাইরে ২-৪ কর্মদিবস।",
  },
  {
    q: "অর্ডার কীভাবে ট্র্যাক করব?",
    a: () =>
      "লগইন করে \"আমার অর্ডার\" পেজে গেলে আপনার সব অর্ডারের বর্তমান স্ট্যাটাস দেখতে পাবেন।",
  },
  {
    q: "পণ্য পরিবর্তন বা ফেরত দেওয়া যাবে?",
    a: () =>
      "হ্যাঁ — ডেলিভারির ৭ দিনের মধ্যে নির্দিষ্ট শর্তে রিটার্ন বা এক্সচেঞ্জ করা যায়। বিস্তারিত জানতে \"রিটার্ন নীতি\" পড়ুন।",
  },
];

export default async function FaqPage() {
  const settings = await getStoreSettings();
  const fees = {
    inside: String(settings?.insideDhakaFee ?? 60),
    outside: String(settings?.outsideDhakaFee ?? 120),
    freeFrom: settings?.freeShippingThreshold ? String(settings.freeShippingThreshold) : null,
  };

  return (
    <InfoPage title="প্রায়শই জিজ্ঞাসিত প্রশ্ন">
      <div className="flex flex-col gap-3">
        {FAQS.map(({ q, a }) => (
          <details key={q} className="rounded-xl border border-slate-200 bg-slate-50 p-4 open:bg-white">
            <summary className="cursor-pointer text-sm font-semibold text-slate-900">{q}</summary>
            <p className="mt-2">{a(fees)}</p>
          </details>
        ))}
      </div>
      <p>
        আরও কিছু জানতে চাই? <a href="/contact">যোগাযোগ</a> করুন।
      </p>
    </InfoPage>
  );
}
