import "server-only";
import { cache } from "react";
import { db } from "@/db";
import { storeSettings } from "@/db/schema";

export type StoreSettings = typeof storeSettings.$inferSelect;

export const getStoreSettings = cache(async (): Promise<StoreSettings | null> => {
  const rows = await db.select().from(storeSettings).limit(1);
  return rows[0] ?? null;
});

export function isStoreConfigured(settings: StoreSettings | null): boolean {
  return Boolean(settings && settings.storeName);
}
