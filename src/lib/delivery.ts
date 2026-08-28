import { isInsideDhaka } from "@/lib/bd-locations";
import type { StoreSettings } from "@/lib/settings";

export type DeliveryEstimate = {
  fee: number;
  configured: boolean;
  freeShippingApplied: boolean;
  freeShippingThreshold: number | null;
};

export function calculateShippingFee(
  settings: StoreSettings | null,
  district: string,
  subtotal: number,
): DeliveryEstimate {
  if (!settings || (settings.insideDhakaFee === null && settings.outsideDhakaFee === null)) {
    return {
      fee: 0,
      configured: false,
      freeShippingApplied: false,
      freeShippingThreshold: null,
    };
  }

  const inside = isInsideDhaka(district);
  const baseFee = Number(
    inside ? settings.insideDhakaFee ?? 0 : settings.outsideDhakaFee ?? 0,
  );
  const threshold =
    settings.freeShippingThreshold !== null && settings.freeShippingThreshold !== undefined
      ? Number(settings.freeShippingThreshold)
      : null;

  const freeShippingApplied = threshold !== null && subtotal >= threshold;

  return {
    fee: freeShippingApplied ? 0 : baseFee,
    configured: true,
    freeShippingApplied,
    freeShippingThreshold: threshold,
  };
}
