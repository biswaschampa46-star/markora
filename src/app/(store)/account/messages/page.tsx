import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle, MessageSquare, PhoneOff, Send, ShoppingBag } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getBuyerOrderMessages, markAllBuyerMessagesAsRead } from "@/lib/queries/orders";
import { getStoreSettings } from "@/lib/settings";
import { formatBanglaDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "অর্ডার সংক্রান্ত বার্তা", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OrderMessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/account/messages");

  const [messages, settings] = await Promise.all([
    getBuyerOrderMessages(user.id),
    getStoreSettings(),
  ]);

  // Opening the inbox marks every message as seen — buyers can read but
  // can never reply here by design.
  if (messages.some((m) => !m.isRead)) {
    await markAllBuyerMessagesAsRead(user.id);
  }

  const whatsappDigits = (settings?.whatsapp ?? "").replace(/[^\d]/g, "");
  const whatsappLink = whatsappDigits
    ? `https://wa.me/${whatsappDigits.startsWith("88") ? whatsappDigits : `88${whatsappDigits}`}`
    : null;
  const facebookLink = settings?.facebook ?? null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link href="/account" className="text-sm text-teal-700 hover:underline">
        ← আমার অ্যাকাউন্ট
      </Link>
      <h1 className="mt-2 flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
        <MessageSquare className="h-6 w-6 text-teal-700" />
        অর্ডার সংক্রান্ত বার্তা
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        আপনার অর্ডার সংক্রান্ত দোকান কর্তৃক পাঠানো বার্তাগুলো এখানে দেখতে পাবেন।
      </p>

      {/* Contact policy: read-only + WhatsApp/Facebook only, no phone calls */}
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">উত্তর দেওয়ার নিয়ম:</p>
        <p className="mt-1">
          এখানে বার্তার উত্তর দেওয়া যাবে না। কথা বলার জন্য অনুগ্রহ করে <strong>WhatsApp</strong> অথবা{" "}
          <strong>Facebook</strong>-এ মেসেজ করুন। <strong>কোনো ফোন কল গ্রহণ করা হয় না।</strong>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {whatsappLink ? (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp-এ মেসেজ করুন
            </a>
          ) : null}
          {facebookLink ? (
            <a
              href={facebookLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Send className="h-4 w-4" /> Facebook-এ মেসেজ করুন
            </a>
          ) : null}
          <span className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-red-600 ring-1 ring-red-200">
            <PhoneOff className="h-4 w-4" /> ফোন কল নিষিদ্ধ
          </span>
        </div>
      </div>

      {/* Message list */}
      {messages.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <MessageSquare className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">এখনও কোনো বার্তা নেই।</p>
          <p className="mt-1 text-xs text-slate-400">
            অর্ডার সংক্রান্ত যেকোনো আপডেট এখানে দেখানো হবে।
          </p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {messages.map((m) => (
            <li key={m.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/my-orders/${m.orderNumber}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:underline"
                >
                  <ShoppingBag className="h-4 w-4" />
                  অর্ডার {m.orderNumber}
                </Link>
                <span className="text-xs text-slate-400">{formatBanglaDateTime(m.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{m.message}</p>
              <p className="mt-2 text-xs text-slate-400">— {m.sentByName ?? "Markora টিম"}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}