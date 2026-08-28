"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-5xl">⚠️</p>
      <h1 className="text-lg font-bold text-slate-900">কিছু একটা সমস্যা হয়েছে</h1>
      <p className="max-w-sm text-sm text-slate-500">
        দুঃখিত! অপ্রত্যাশিত একটি ত্রুটির কারণে পেজটি দেখানো যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-800"
      >
        আবার চেষ্টা করুন
      </button>
    </div>
  );
}
