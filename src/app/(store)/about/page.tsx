import type { Metadata } from "next";
import { InfoPage } from "@/components/buyer/InfoPage";
import { getStoreSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "আমাদের সম্পর্কে",
  description: "আমাদের স্টোর সম্পর্কে জানুন — আমাদের লক্ষ্য, প্রতিশ্রুতি ও পরিষেবা।",
};

export default async function AboutPage() {
  const settings = await getStoreSettings();
  const storeName = settings?.storeName || "মার্কোরা";

  return (
    <InfoPage title="আমাদের সম্পর্কে">
      <p>
        {storeName} বাংলাদেশের একটি বিশ্বস্ত অনলাইন শপিং প্ল্যাটফর্ম। আমাদের লক্ষ্য একটিই — সারা
        বাংলাদেশের মানুষের দোরগোড়ায় সঠিক দামে গুণগত মানের পণ্য পৌঁছে দেওয়া।
      </p>
      <h2>আমাদের প্রতিশ্রুতি</h2>
      <ul>
        <li>১০০% অরিজিনাল ও গুণগত মানের পণ্য</li>
        <li>সঠিক দাম ও স্বচ্ছ মূল্য নীতি</li>
        <li>দ্রুত ও নিরাপদ ডেলিভারি — ঢাকার ভেতরে ও বাইরে</li>
        <li>সহজ রিটার্ন ও রিফান্ড নীতি</li>
        <li>অর্ডার করার পরেও বিক্রয়-পরবর্তী সহায়তা</li>
      </ul>
      <h2>কেন {storeName}?</h2>
      <p>
        ক্যাশ অন ডেলিভারি (COD), বিকাশ, নগদ ও রকেটের মাধ্যমে পেমেন্টের সুবিধা, সহজ অর্ডার ট্র্যাকিং
        এবং বাংলা ভাষায় সম্পূর্ণ শপিং অভিজ্ঞতা — সবকিছু এক জায়গায়।
      </p>
    </InfoPage>
  );
}
