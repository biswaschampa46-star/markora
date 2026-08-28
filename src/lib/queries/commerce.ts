import "server-only";
import { db } from "@/db";
import {
  addresses,
  cartItems,
  flashSaleItems,
  flashSales,
  products,
  productVariants,
  recentlyViewed,
  wishlistItems,
} from "@/db/schema";
import { and, desc, eq, gt, inArray, lt } from "drizzle-orm";
import { computePrice, availableStock } from "@/lib/pricing";

/** Active flash-sale prices keyed by product id (only sales running right now). */
export async function getActiveFlashPrices(productIds: number[]): Promise<Map<number, number>> {
  if (productIds.length === 0) return new Map();
  const now = new Date();
  const rows = await db
    .select({ productId: flashSaleItems.productId, discountPrice: flashSaleItems.discountPrice })
    .from(flashSales)
    .innerJoin(flashSaleItems, eq(flashSaleItems.flashSaleId, flashSales.id))
    .where(
      and(
        eq(flashSales.isActive, true),
        lt(flashSales.startTime, now),
        gt(flashSales.endTime, now),
        inArray(flashSaleItems.productId, productIds),
      ),
    );
  return new Map(rows.map((r) => [r.productId, Number(r.discountPrice)]));
}

export async function getCartWithDetails(userId: number) {
  const rows = await db
    .select({
      item: cartItems,
      product: products,
      variant: productVariants,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .leftJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .where(and(eq(cartItems.userId, userId), eq(cartItems.savedForLater, false)))
    .orderBy(desc(cartItems.createdAt));

  // Flash-sale price overrides the regular/discounted price so cart and checkout
  // match what the homepage flash section advertises.
  const flashPrices = await getActiveFlashPrices([...new Set(rows.map((r) => r.product.id))]);

  return rows.map(({ item, product, variant }) => {
    let priceInfo = computePrice(variant ?? product);
    const regularPrice = priceInfo.price;
    const flashPrice = flashPrices.get(product.id);
    if (flashPrice !== undefined && flashPrice < regularPrice) {
      const base = Number(variant?.price ?? product.basePrice ?? regularPrice);
      priceInfo = {
        ...priceInfo,
        price: flashPrice,
        originalPrice: regularPrice,
        discountPercent: base > 0 ? Math.round(((base - flashPrice) / base) * 100) : 0,
        hasDiscount: true,
      };
    }

    const stockAvailable = variant
      ? availableStock(variant.stock, variant.reservedStock)
      : availableStock(product.stock, product.reservedStock);
    const isActive = product.isActive && (!variant || variant.isActive);

    return {
      id: item.id,
      quantity: item.quantity,
      product,
      variant,
      priceInfo,
      stockAvailable,
      isAvailable: isActive && stockAvailable > 0,
      lineTotal: priceInfo.price * item.quantity,
    };
  });
}

export async function getCartCount(userId: number) {
  const rows = await db
    .select({ quantity: cartItems.quantity })
    .from(cartItems)
    .where(and(eq(cartItems.userId, userId), eq(cartItems.savedForLater, false)));
  return rows.reduce((sum, r) => sum + r.quantity, 0);
}

/** Items parked under "save for later" on the cart page. */
export async function getSavedForLater(userId: number) {
  const rows = await db
    .select({ item: cartItems, product: products })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(and(eq(cartItems.userId, userId), eq(cartItems.savedForLater, true)))
    .orderBy(desc(cartItems.createdAt));

  return rows.map(({ item, product }) => ({
    id: item.id,
    product,
    priceInfo: computePrice(product),
    stockAvailable: availableStock(product.stock, product.reservedStock),
  }));
}

export async function getWishlistWithDetails(userId: number) {
  const rows = await db
    .select({ item: wishlistItems, product: products })
    .from(wishlistItems)
    .innerJoin(products, eq(wishlistItems.productId, products.id))
    .where(eq(wishlistItems.userId, userId))
    .orderBy(desc(wishlistItems.createdAt));

  return rows.map(({ item, product }) => ({
    id: item.id,
    product,
    priceInfo: computePrice(product),
    stockAvailable: availableStock(product.stock, product.reservedStock),
  }));
}

export async function getWishlistProductIds(userId: number) {
  const rows = await db
    .select({ productId: wishlistItems.productId })
    .from(wishlistItems)
    .where(eq(wishlistItems.userId, userId));
  return new Set(rows.map((r) => r.productId));
}

export async function getUserAddresses(userId: number) {
  return db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, userId))
    .orderBy(desc(addresses.isDefault), desc(addresses.createdAt));
}

export async function getRecentlyViewed(userId: number, limit = 10) {
  const rows = await db
    .select({ product: products })
    .from(recentlyViewed)
    .innerJoin(products, eq(recentlyViewed.productId, products.id))
    .where(and(eq(recentlyViewed.userId, userId), eq(products.isActive, true)))
    .orderBy(desc(recentlyViewed.viewedAt))
    .limit(limit);
  return rows.map((r) => r.product);
}
