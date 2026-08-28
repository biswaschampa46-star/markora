import type { Metadata } from "next";
import { InfoPage } from "@/components/buyer/InfoPage";
import { getStoreSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "ডেলিভারি নীতি",
  description: "ডেলিভারি চার্জ, সময়সীমা ও সংক্রান্ত নীতিমালা।",
};

export default async function ShippingPolicyPage() {
  const settings = await getStoreSettings();
  const insideFee = settings?.insideDhakaFee ? String(settings.insideDhakaFee) : "৬০";
  const outsideFee = settings?.outsideDhakaFee ? String(settings.outsideDhakaFee) : "১২০";

  return (
    <InfoPage title="ডেলিভারি নীতি">
      <h2>ডেলিভারি এলাকা</h2>
      <p>আমরা বাংলাদেশের সর্বত্র ডেলিভারি করি — ঢাকার ভেতরে ও ঢাকার বাইরে।</p>
      <h2>ডেলিভারি চার্জ</h2>
      <ul>
        <li>ঢাকার ভেতরে: {insideFee} টাকা</li>
        <li>ঢাকার বাইরে: {outsideFee} টাকা</li>
      </ul>
      <h2>ডেলিভারির সময়সীমা</h2>
      <ul>
        <li>ঢাকার ভেতরে: সাধারণত ১-২ কর্মদিবস</li>
        <li>ঢাকার বাইরে: সাধারণত ২-৪ কর্মদিবস</li>
      </ul>
      <p>
        ছুটি, দুর্যোগ বা অপ্রত্যাশিত পরিস্থিতিতে সময় কিছুটা বাড়তে পারে — সেক্ষেত্রে আমরা আপনাকে
        জানিয়ে রাখব।
      </p>
      <h2>অর্ডার নিশ্চিতকরণ</h2>
      <p>
        অর্ডারের পর আমাদের প্রতিনিধি ফোনে অর্ডারটি নিশ্চিত করবেন। একাধিকবার যোগাযোগের পরও
        নিশ্চিত করা না গেলে অর্ডারটি বাতিল হয়ে যাবে।
      </p>
    </InfoPage>
  );
}
