export type PriceableEntity = {
  basePrice?: string | number | null;
  price?: string | number | null;
  discountPrice?: string | number | null;
};

export type PriceInfo = {
  price: number;
  originalPrice: number | null;
  discountPercent: number;
  hasDiscount: boolean;
};

export function computePrice(entity: PriceableEntity): PriceInfo {
  const base = Number(entity.basePrice ?? entity.price ?? 0);
  const discount = entity.discountPrice !== null && entity.discountPrice !== undefined
    ? Number(entity.discountPrice)
    : null;

  if (discount !== null && discount > 0 && discount < base) {
    const discountPercent = Math.round(((base - discount) / base) * 100);
    return {
      price: discount,
      originalPrice: base,
      discountPercent,
      hasDiscount: true,
    };
  }

  return {
    price: base,
    originalPrice: null,
    discountPercent: 0,
    hasDiscount: false,
  };
}

export function availableStock(stock: number, reservedStock: number): number {
  return Math.max(0, stock - reservedStock);
}
