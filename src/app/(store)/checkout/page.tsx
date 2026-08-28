import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCartWithDetails, getUserAddresses } from "@/lib/queries/commerce";
import { getStoreSettings } from "@/lib/settings";
import { PAYMENT_METHOD_LABELS } from "@/lib/status";
import { CheckoutForm } from "@/components/buyer/CheckoutForm";
import { getBuyerTrust } from "@/lib/trust";
import { getBuyerVerification } from "@/lib/verified-buyer";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "অর্ডার সম্পন্ন করুন", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/checkout");

  const [cart, addresses, settings, trust, verification] = await Promise.all([
    getCartWithDetails(user.id),
    getUserAddresses(user.id),
    getStoreSettings(),
    getBuyerTrust(user.id),
    getBuyerVerification(user.id),
  ]);

  const availableCart = cart.filter((i) => i.isAvailable);

  if (cart.length === 0 || availableCart.length !== cart.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <EmptyState
          title={cart.length === 0 ? "আপনার কার্ট খালি রয়েছে।" : "কার্টে থাকা কিছু পণ্য বর্তমানে স্টকে নেই।"}
          description="অর্ডার সম্পন্ন করতে অনুগ্রহ করে কার্ট পরীক্ষা করুন।"
          action={
            <Link href="/cart">
              <Button size="sm">কার্টে যান</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const subtotal = availableCart.reduce((sum, i) => sum + i.lineTotal, 0);

  const paymentOptions: { value: string; label: string; number: string | null }[] = [];
  // COD unlocks for verified buyers immediately; everyone else needs
  // DELIVERY_TRUST_THRESHOLD delivered products.
  if ((settings?.codEnabled ?? true) && (verification.isVerifiedBuyer || trust.codEligible)) {
    paymentOptions.push({ value: "cod", label: PAYMENT_METHOD_LABELS.cod, number: null });
  }
  if (settings?.bkashEnabled) {
    paymentOptions.push({ value: "bkash", label: PAYMENT_METHOD_LABELS.bkash, number: settings.bkashNumber });
  }
  if (settings?.nagadEnabled) {
    paymentOptions.push({ value: "nagad", label: PAYMENT_METHOD_LABELS.nagad, number: settings.nagadNumber });
  }
  if (settings?.rocketEnabled) {
    paymentOptions.push({ value: "rocket", label: PAYMENT_METHOD_LABELS.rocket, number: settings.rocketNumber });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">অর্ডার সম্পন্ন করুন</h1>
      <div className="mt-6">
        <CheckoutForm
          addresses={addresses}
          subtotal={subtotal}
          insideDhakaFee={settings?.insideDhakaFee != null ? Number(settings.insideDhakaFee) : null}
          outsideDhakaFee={settings?.outsideDhakaFee != null ? Number(settings.outsideDhakaFee) : null}
          freeShippingThreshold={settings?.freeShippingThreshold ? Number(settings.freeShippingThreshold) : null}
          paymentOptions={paymentOptions}
          codEligible={verification.isVerifiedBuyer || (trust.codEligible && (settings?.codEnabled ?? true))}
          remainingForCod={trust.remainingForCod}
          isVerifiedBuyer={verification.isVerifiedBuyer}
          remainingForVerification={verification.remainingForVerification}
        />
      </div>
    </div>
  );
}
