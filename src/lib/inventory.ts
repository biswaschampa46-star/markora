import "server-only";
import { eq, sql } from "drizzle-orm";
import type { db as dbType } from "@/db";
import { inventoryLogs, productVariants, products } from "@/db/schema";

type Tx = Parameters<Parameters<typeof dbType.transaction>[0]>[0];

export type StockLineItem = {
  productId: number;
  variantId: number | null;
  quantity: number;
};

/** Holds stock for a newly placed order (increments reservedStock only). */
export async function reserveStockForOrder(tx: Tx, items: StockLineItem[], adminId: number | null = null) {
  for (const item of items) {
    if (item.variantId) {
      await tx
        .update(productVariants)
        .set({ reservedStock: sql`${productVariants.reservedStock} + ${item.quantity}` })
        .where(eq(productVariants.id, item.variantId));
    } else {
      await tx
        .update(products)
        .set({ reservedStock: sql`${products.reservedStock} + ${item.quantity}` })
        .where(eq(products.id, item.productId));
    }
    await tx.insert(inventoryLogs).values({
      productId: item.productId,
      variantId: item.variantId,
      type: "order",
      quantity: -item.quantity,
      note: "অর্ডারের জন্য স্টক সংরক্ষিত হয়েছে",
      adminId,
    });
  }
}

/** Releases a reservation hold without touching physical stock (used for cancellation before fulfillment). */
export async function releaseReservedStock(tx: Tx, items: StockLineItem[], adminId: number | null = null) {
  for (const item of items) {
    if (item.variantId) {
      await tx
        .update(productVariants)
        .set({ reservedStock: sql`GREATEST(0, ${productVariants.reservedStock} - ${item.quantity})` })
        .where(eq(productVariants.id, item.variantId));
    } else {
      await tx
        .update(products)
        .set({ reservedStock: sql`GREATEST(0, ${products.reservedStock} - ${item.quantity})` })
        .where(eq(products.id, item.productId));
    }
    await tx.insert(inventoryLogs).values({
      productId: item.productId,
      variantId: item.variantId,
      type: "cancel",
      quantity: item.quantity,
      note: "অর্ডার বাতিলের কারণে স্টক মুক্ত করা হয়েছে",
      adminId,
    });
  }
}

/** Finalizes the sale: converts a reservation into an actual stock deduction. */
export async function finalizeStockForOrder(tx: Tx, items: StockLineItem[], adminId: number | null = null) {
  for (const item of items) {
    if (item.variantId) {
      await tx
        .update(productVariants)
        .set({
          stock: sql`GREATEST(0, ${productVariants.stock} - ${item.quantity})`,
          reservedStock: sql`GREATEST(0, ${productVariants.reservedStock} - ${item.quantity})`,
        })
        .where(eq(productVariants.id, item.variantId));
    } else {
      await tx
        .update(products)
        .set({
          stock: sql`GREATEST(0, ${products.stock} - ${item.quantity})`,
          reservedStock: sql`GREATEST(0, ${products.reservedStock} - ${item.quantity})`,
        })
        .where(eq(products.id, item.productId));
    }
    await tx
      .update(products)
      .set({ soldCount: sql`${products.soldCount} + ${item.quantity}` })
      .where(eq(products.id, item.productId));

    await tx.insert(inventoryLogs).values({
      productId: item.productId,
      variantId: item.variantId,
      type: "stock_out",
      quantity: -item.quantity,
      note: "ডেলিভারি সম্পন্ন হওয়ায় স্টক থেকে বাদ দেওয়া হয়েছে",
      adminId,
    });
  }
}

/** Restores physical stock after a delivered order is returned. */
export async function restoreStockForReturn(tx: Tx, items: StockLineItem[], adminId: number | null = null) {
  for (const item of items) {
    if (item.variantId) {
      await tx
        .update(productVariants)
        .set({ stock: sql`${productVariants.stock} + ${item.quantity}` })
        .where(eq(productVariants.id, item.variantId));
    } else {
      await tx
        .update(products)
        .set({ stock: sql`${products.stock} + ${item.quantity}` })
        .where(eq(products.id, item.productId));
    }
    await tx.insert(inventoryLogs).values({
      productId: item.productId,
      variantId: item.variantId,
      type: "return",
      quantity: item.quantity,
      note: "পণ্য ফেরত আসায় স্টকে যোগ করা হয়েছে",
      adminId,
    });
  }
}
