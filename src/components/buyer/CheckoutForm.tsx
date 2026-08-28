"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { placeOrderAction, type CheckoutState } from "@/actions/checkout";
import { Button } from "@/components/ui/Button";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { formatBDT } from "@/lib/format";
import { BD_DIVISION_LIST, districtsFor, divisionOf, isInsideDhaka } from "@/lib/bd-locations";
import { CustomSelect } from "@/components/ui/CustomSelect";

type Address = {
  id: number;
  label: string;
  recipientName: string;
  phone: string;
  division: string;
  district: string;
  upazila: string | null;
  addressLine: string;
  isDefault: boolean;
};

type GeoStatus =
  | "idle"
  | "locating"
  | "success"
  | "partial"
  | "denied"
  | "timeout"
  | "unavailable"
  | "unsupported"
  | "insecure"
  | "outside_bd"
  | "service_error";

type GeoStatusMessage = { text: string; tone: "info" | "success" | "warning" | "error" };

const GEO_STATUS_MESSAGES: Record<GeoStatus, { text: string; tone: "info" | "success" | "warning" | "error" } | null> = {
  idle: null,
  locating: { text: "আপনার লোকেশন নেওয়া হচ্ছে…", tone: "info" },
  success: { text: "ঠিকানা স্বয়ংক্রিয়ভাবে পূরণ হয়েছে। সঠিক হলে অর্ডার করুন।", tone: "success" },
  partial: { text: "এলাকা শনাক্ত হয়েছে — বিভাগ/জেলা নিজে নির্বাচন করুন।", tone: "warning" },
  denied: {
    text: "লোকেশনের অনুমতি পাওয়া যায়নি। ব্রাউজারের ঠিকানা-দণ্ডের তালার আইকন থেকে অনুমতি দিয়ে আবার চেষ্টা করুন।",
    tone: "error",
  },
  timeout: { text: "আপনার লোকেশন পাওয়া যায়নি। ম্যানুয়ালি ঠিকানা লিখুন।", tone: "warning" },
  unavailable: { text: "আপনার লোকেশন পাওয়া যায়নি। ম্যানুয়ালি ঠিকানা লিখুন।", tone: "warning" },
  unsupported: { text: "এই ব্রাউজারে লোকেশন সাপোর্ট নেই। ম্যানুয়ালি ঠিকানা লিখুন।", tone: "warning" },
  insecure: {
    text: "লোকেশন শেয়ার করতে HTTPS সংযোগ প্রয়োজন। অনুগ্রহ করে localhost বা https দিয়ে সাইটটি খুলুন, অথবা ম্যানুয়ালি ঠিকানা লিখুন।",
    tone: "error",
  },
  outside_bd: { text: "আপনি বাংলাদেশের বাইরে আছেন বলে মনে হচ্ছে।", tone: "error" },
  service_error: { text: "ঠিকানা আনা যায়নি। এখনই ম্যানুয়ালি লিখুন বা আবার চেষ্টা করুন।", tone: "error" },
};

const GEO_TONE_CLASSES: Record<GeoStatusMessage["tone"], string> = {
  info: "text-slate-500",
  success: "text-emerald-600",
  warning: "text-amber-600",
  error: "text-red-600",
};

export function CheckoutForm({
  addresses,
  subtotal,
  insideDhakaFee,
  outsideDhakaFee,
  freeShippingThreshold,
  paymentOptions,
  codEligible = true,
  remainingForCod = 0,
  isVerifiedBuyer = false,
  remainingForVerification = 0,
}: {
  addresses: Address[];
  subtotal: number;
  insideDhakaFee: number | null;
  outsideDhakaFee: number | null;
  freeShippingThreshold: number | null;
  paymentOptions: { value: string; label: string; number: string | null }[];
  codEligible?: boolean;
  remainingForCod?: number;
  isVerifiedBuyer?: boolean;
  remainingForVerification?: number;
}) {
  const [state, formAction, isPending] = useActionState<CheckoutState, FormData>(placeOrderAction, null);
  const [selectedAddressId, setSelectedAddressId] = useState<number | "new">(
    addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? "new",
  );
  const [division, setDivision] = useState(BD_DIVISION_LIST[0]);
  const [district, setDistrict] = useState(districtsFor(BD_DIVISION_LIST[0])[0] ?? "");
  const [paymentMethod, setPaymentMethod] = useState(paymentOptions[0]?.value ?? "");
  const [upazila, setUpazila] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const geoRequestId = useRef(0);

  const currentDistrict = useMemo(() => {
    if (selectedAddressId !== "new") {
      const addr = addresses.find((a) => a.id === selectedAddressId);
      return addr?.district ?? district;
    }
    return district;
  }, [selectedAddressId, addresses, district]);

  const shippingFee = useMemo(() => {
    if (insideDhakaFee === null && outsideDhakaFee === null) return null;
    const fee = isInsideDhaka(currentDistrict) ? insideDhakaFee ?? 0 : outsideDhakaFee ?? 0;
    if (freeShippingThreshold !== null && subtotal >= freeShippingThreshold) return 0;
    return fee;
  }, [currentDistrict, insideDhakaFee, outsideDhakaFee, freeShippingThreshold, subtotal]);

  const total = Math.max(0, subtotal + (shippingFee ?? 0));

  const selectedPaymentOption = paymentOptions.find((p) => p.value === paymentMethod);

  /** Browser location → /api/geo/reverse → auto-fill the new-address fields. */
  const shareLocation = () => {
    if (geoStatus === "locating") return;
    // Geolocation only works on secure origins (https or localhost) — on a
    // plain-HTTP LAN IP the API exists but fails silently, so say so up front.
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setGeoStatus("insecure");
      return;
    }
    if (!("geolocation" in navigator)) {
      setGeoStatus("unsupported");
      return;
    }
    const requestId = ++geoRequestId.current;
    setGeoStatus("locating");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch("/api/geo/reverse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: coords.latitude, lng: coords.longitude }),
          });
          const data = await res.json();
          if (requestId !== geoRequestId.current) return;
          if (!res.ok || !data.ok) {
            setGeoStatus(data?.error === "outside_bd" ? "outside_bd" : "service_error");
            return;
          }
          // District is authoritative for the division — fill each field
          // independently so a partial match still fills what it can.
          if (data.district) {
            setDistrict(data.district);
            const div = divisionOf(data.district) ?? data.division;
            if (div) setDivision(div);
          } else if (data.division) {
            setDivision(data.division);
            setDistrict(districtsFor(data.division)[0] ?? "");
          }
          setUpazila(data.upazila ?? "");
          if (typeof data.addressLine === "string" && data.addressLine.trim().length > 0) {
            setAddressLine(data.addressLine.trim());
          }
          setGeoStatus(data.division && data.district ? "success" : "partial");
        } catch {
          if (requestId === geoRequestId.current) setGeoStatus("service_error");
        }
      },
      (err) => {
        if (requestId !== geoRequestId.current) return;
        if (err.code === err.PERMISSION_DENIED) setGeoStatus("denied");
        else if (err.code === err.TIMEOUT) setGeoStatus("timeout");
        else setGeoStatus("unavailable");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
    );
  };

  return (
    <form action={formAction} className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-6">
        {/* ঠিকানা */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">১. ডেলিভারি ঠিকানা</h2>
          <div className="mt-3 flex flex-col gap-2">
            {addresses.map((addr) => (
              <label
                key={addr.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${
                  selectedAddressId === addr.id ? "border-teal-600 bg-teal-50/50" : "border-slate-200"
                }`}
              >
                <input
                  type="radio"
                  name="addressChoice"
                  checked={selectedAddressId === addr.id}
                  onChange={() => setSelectedAddressId(addr.id)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium text-slate-800">{addr.recipientName}</span> ({addr.label}) — {addr.phone}
                  <br />
                  <span className="text-slate-500">
                    {addr.addressLine}, {addr.upazila ? `${addr.upazila}, ` : ""}
                    {addr.district}, {addr.division}
                  </span>
                </span>
              </label>
            ))}
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${
                selectedAddressId === "new" ? "border-teal-600 bg-teal-50/50" : "border-slate-200"
              }`}
            >
              <input
                type="radio"
                name="addressChoice"
                checked={selectedAddressId === "new"}
                onChange={() => setSelectedAddressId("new")}
                className="mt-1"
              />
              <span className="font-medium text-slate-800">নতুন ঠিকানা যোগ করুন</span>
            </label>
          </div>

          {selectedAddressId === "new" ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1 sm:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={geoStatus === "locating"}
                  onClick={shareLocation}
                  className="self-start"
                >
                  <MapPin className="h-4 w-4" />
                  আপনার এলাকা শেয়ার করুন
                </Button>
                {GEO_STATUS_MESSAGES[geoStatus] && (
                  <p aria-live="polite" className={`text-xs ${GEO_TONE_CLASSES[GEO_STATUS_MESSAGES[geoStatus]!.tone]}`}>
                    {GEO_STATUS_MESSAGES[geoStatus]!.text}
                  </p>
                )}
              </div>
              <input name="recipientName" required placeholder="গ্রহীতার নাম" className="h-11 rounded-lg border border-slate-300 px-3 text-sm sm:col-span-1" />
              <input name="phone" required placeholder="মোবাইল নম্বর (017XXXXXXXX)" className="h-11 rounded-lg border border-slate-300 px-3 text-sm" />
              <CustomSelect
                name="division"
                value={division}
                onChange={(v) => {
                  setDivision(v);
                  setDistrict(districtsFor(v)[0] ?? "");
                }}
                options={BD_DIVISION_LIST.map((d) => ({ value: d, label: d }))}
                className="h-11 sm:col-span-1"
                ariaLabel="বিভাগ"
              />
              <CustomSelect
                name="district"
                value={district}
                onChange={setDistrict}
                options={districtsFor(division).map((d) => ({ value: d, label: d }))}
                className="h-11"
                ariaLabel="জেলা"
              />
              <input
                name="upazila"
                value={upazila}
                onChange={(e) => setUpazila(e.target.value)}
                placeholder="থানা/উপজেলা (ঐচ্ছিক)"
                className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
              />
              <input name="label" placeholder="ঠিকানার নাম (যেমনঃ বাসা, অফিস)" defaultValue="বাসা" className="h-11 rounded-lg border border-slate-300 px-3 text-sm" />
              <textarea
                name="addressLine"
                required
                value={addressLine}
                onChange={(e) => {
                  setAddressLine(e.target.value);
                  if (geoStatus !== "idle" && geoStatus !== "locating") setGeoStatus("idle");
                }}
                placeholder="সম্পূর্ণ ঠিকানা (বাসা/রোড/এলাকা)"
                rows={2}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
              />
              <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2">
                <input type="checkbox" name="saveAddress" defaultChecked /> এই ঠিকানাটি আমার প্রোফাইলে সংরক্ষণ করুন
              </label>
            </div>
          ) : (
            <input type="hidden" name="addressId" value={selectedAddressId} />
          )}
        </div>

        {/* পেমেন্ট */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">২. পেমেন্ট পদ্ধতি</h2>
          {isVerifiedBuyer ? (
            <div className="mt-2 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">
              🛡️ আপনি একজন <strong>Verified Markora Buyer</strong> — ডেলিভারি চার্জ প্রি-পেমেন্টের প্রয়োজন নেই।
            </div>
          ) : (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <strong>ডেলিভারি চার্জ অগ্রিম (pre-pay) আবশ্যক।</strong> নতুন ক্রেতাদের জন্য ডেলিভারি চার্জ bKash/Nagad-এ
              আগে পাঠিয়ে Transaction ID দিতে হবে। অ্যাডমিন যাচাই করার পরেই অর্ডার প্রসেস হবে। সফলভাবে{" "}
              <strong>৩টি অর্ডার</strong> সম্পন্ন করলে Verified Buyer ব্যাজ পাবেন এবং প্রি-পেমেন্টের প্রয়োজন হবে না
              (বর্তমানে আর <strong>{remainingForVerification}</strong>টি অর্ডার বাকি)।
            </div>
          )}
          {paymentOptions.length === 0 ? (
            <p className="mt-2 text-sm text-red-600">এই মুহূর্তে কোনো পেমেন্ট পদ্ধতি উপলভ্য নয়। অনুগ্রহ করে পরে চেষ্টা করুন।</p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {paymentOptions.map((opt) => {
                const isBkash = opt.value === "bkash";
                const isNagad = opt.value === "nagad";
                const isSelected = paymentMethod === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${
                      isSelected
                        ? isBkash
                          ? "border-[#E2136E] bg-pink-50/60"
                          : isNagad
                            ? "border-[#F6921E] bg-orange-50/60"
                            : "border-teal-600 bg-teal-50/50"
                        : "border-slate-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={opt.value}
                      checked={isSelected}
                      onChange={() => setPaymentMethod(opt.value)}
                      className={isBkash ? "accent-[#E2136E]" : isNagad ? "accent-[#F6921E]" : ""}
                    />
                    {isBkash && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src="/images/bkash-logo.png"
                        alt="bKash"
                        className="h-7 w-12 shrink-0 object-contain object-left"
                      />
                    )}
                    {isNagad && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src="/images/nagad-logo.png"
                        alt="Nagad"
                        className="h-7 w-11 shrink-0 rounded object-contain"
                      />
                    )}
                    <span
                      className={`font-medium ${
                        isBkash && isSelected
                          ? "text-[#E2136E]"
                          : isNagad && isSelected
                            ? "text-[#ED1C24]"
                            : "text-slate-800"
                      }`}
                    >
                      {opt.label}
                    </span>
                  </label>
                );
              })}
              {selectedPaymentOption && selectedPaymentOption.value !== "cod" && (
                <div
                  className={`mt-2 rounded-lg p-3 text-sm ${
                    selectedPaymentOption.value === "bkash"
                      ? "border border-pink-200 bg-pink-50 text-[#C50D5C]"
                      : selectedPaymentOption.value === "nagad"
                        ? "border border-orange-200 bg-orange-50 text-[#B45309]"
                        : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {selectedPaymentOption.number ? (
                    isVerifiedBuyer ? (
                      <p>
                        অনুগ্রহ করে <strong>{selectedPaymentOption.number}</strong> নম্বরে অর্ডারের{" "}
                        <strong>সর্বমোট {total}</strong> টাকা পাঠিয়ে নিচে লেনদেন আইডি (Transaction ID) লিখুন।
                      </p>
                    ) : (
                      <p>
                        অনুগ্রহ করে <strong>{selectedPaymentOption.number}</strong> নম্বরে{" "}
                        <strong>{shippingFee ?? 0}</strong> টাকা Delevery Charge পাঠিয়ে নিচে লেনদেন আইডি (Transaction ID) লিখুন।
                      </p>
                    )
                  ) : (
                    <p>পেমেন্ট নম্বর এখনও সেট করা হয়নি।</p>
                  )}
                  <input
                    name="transactionId"
                    required
                    placeholder="লেনদেন আইডি (Transaction ID)"
                    className={`mt-2 h-10 w-full rounded-lg border bg-white px-3 text-sm ${
                      selectedPaymentOption.value === "bkash"
                        ? "border-pink-300 focus:border-[#E2136E]"
                        : selectedPaymentOption.value === "nagad"
                          ? "border-orange-300 focus:border-[#F6921E]"
                          : "border-amber-300"
                    }`}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* কাস্টমার নোট */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">৩. অতিরিক্ত নির্দেশনা (ঐচ্ছিক)</h2>
          <textarea
            name="customerNote"
            rows={2}
            placeholder="ডেলিভারি সংক্রান্ত কোনো বিশেষ নির্দেশনা থাকলে লিখুন"
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* সারাংশ */}
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">অর্ডার সারাংশ</h2>

          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div className="flex justify-between"><span>সাবটোটাল</span><PriceDisplay price={subtotal} /></div>
            <div className="flex justify-between">
              <span>ডেলিভারি চার্জ</span>
              <span>{shippingFee === null ? "নির্ধারণ করা হয়নি" : formatBDT(shippingFee)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold text-slate-900">
              <span>সর্বমোট</span>
              <PriceDisplay price={total} />
            </div>
          </div>

          {state?.error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}

          <Button type="submit" fullWidth className="mt-4" loading={isPending} disabled={paymentOptions.length === 0}>
            অর্ডার নিশ্চিত করুন
          </Button>
        </div>
      </div>
    </form>
  );
}
