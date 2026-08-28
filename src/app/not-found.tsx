import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-6xl font-extrabold text-teal-700">৪০৪</p>
      <h1 className="text-lg font-bold text-slate-900">পেজটি খুঁজে পাওয়া যায়নি</h1>
      <p className="max-w-sm text-sm text-slate-500">
        আপনি যে পেজটি খুঁজছেন সেটি হয়তো সরিয়ে ফেলা হয়েছে বা লিংকটি ভুল।
      </p>
      <Link
        href="/"
        className="mt-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-800"
      >
        হোমপেজে ফিরে যান
      </Link>
    </div>
  );
}
