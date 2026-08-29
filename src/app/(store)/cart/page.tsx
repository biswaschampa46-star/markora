import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCartWithDetails, getSavedForLater } from "@/lib/queries/commerce";
import { getStoreSettings } from "@/lib/settings";
import { CartItemRow } from "@/components/buyer/CartItemRow";
import { SavedItemRow } from "@/components/buyer/SavedItemRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { formatBDT } from "@/lib/format";
import { ShoppingBag } from "lucide-react";

export const metadata: Metadata = { title: "আমার কার্ট" };
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/cart");

  const [items, savedItems, settings] = await Promise.all([
    getCartWithDetails(user.id),
    getSavedForLater(user.id),
    getStoreSettings(),
  ]);

  const availableItems = items.filter((i) => i.isAvailable);
  const subtotal = availableItems.reduce((sum, i) => sum + i.lineTotal, 0);

  const threshold = settings?.freeShippingThreshold ? Number(settings.freeShippingThreshold) : null;
  const remainingForFreeShipping = threshold ? Math.max(0, threshold - subtotal) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">আমার কার্ট</h1>

      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<ShoppingBag className="h-7 w-7" />}
            title="আপনার কার্ট খালি রয়েছে।"
            description="পণ্য যোগ করতে আমাদের সংগ্রহ দেখুন।"
            action={
              <Link href="/products">
                <Button size="sm">পণ্য দেখুন</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            {items.map((item) => (
              <CartItemRow
                key={item.id}
                item={{
                  id: item.id,
                  quantity: item.quantity,
                  size: item.size,
                  isAvailable: item.isAvailable,
                  stockAvailable: item.stockAvailable,
                  lineTotal: item.lineTotal,
                  priceInfo: item.priceInfo,
                  product: item.product,
                  variant: item.variant ? { name: item.variant.name } : null,
                }}
              />
            ))}
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-800">অর্ডার সারাংশ</h2>
              <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                <span>সাবটোটাল</span>
                <PriceDisplay price={subtotal} />
              </div>
              {remainingForFreeShipping !== null && (
                <p className="mt-2 text-xs text-slate-500">
                  {remainingForFreeShipping > 0
                    ? `আর মাত্র ${formatBDT(remainingForFreeShipping)} কিনলে বিনামূল্যে ডেলিভারি পাবেন।`
                    : "অভিনন্দন! আপনি বিনামূল্যে ডেলিভারির জন্য যোগ্য।"}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-400">ডেলিভারি চার্জ চেকআউটে যোগ হবে।</p>
              <Link href="/checkout">
                <Button fullWidth className="mt-4" disabled={availableItems.length === 0}>
                  অর্ডার সম্পন্ন করুন
                </Button>
              </Link>
              {availableItems.length === 0 && (
                <p className="mt-2 text-xs text-red-600">স্টক শেষ থাকা পণ্য বাদে অর্ডার করা সম্ভব নয়।</p>
              )}
            </div>
          </div>
        </div>
      )}

      {savedItems.length > 0 && (
        <section className="mt-8">
          <h2 className="text-base font-semibold text-slate-900">পরে কেনার জন্য সংরক্ষিত ({savedItems.length})</h2>
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
            {savedItems.map((saved) => (
              <SavedItemRow
                key={saved.id}
                item={{
                  id: saved.id,
                  product: saved.product,
                  priceInfo: saved.priceInfo,
                  stockAvailable: saved.stockAvailable,
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
