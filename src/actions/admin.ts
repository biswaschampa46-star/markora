"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  banners,
  notifications,
  categories,
  flashSaleItems,
  flashSales,
  orderItems,
  orders,
  orderMessages,
  orderStatusHistory,
  productVariants,
  products,
  reviews,
  storeSettings,
  deliveryPayments,
  users,
} from "@/db/schema";
import { assertAdmin, requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { formatBanglaDate, slugify } from "@/lib/format";
import { sendOrderStatusEmail } from "@/lib/email";
import { recomputeProductRating } from "@/lib/ratings";
import { ALLOWED_TRANSITIONS } from "@/lib/status";
import {
  finalizeStockForOrder,
  releaseReservedStock,
  restoreStockForReturn,
  type StockLineItem,
} from "@/lib/inventory";
import { uploadProductImage, deleteProductImage, describeUploadError } from "@/lib/supabase";
import { applySuccessfulOrder, reverseSuccessfulOrder } from "@/lib/verified-buyer";

type ActionResult = { ok: boolean; message: string; id?: number };

/** Form-friendly wrappers so <form action={...}> works directly on server pages. */
export async function updateOrderStatusFormAction(formData: FormData): Promise<void> {
  const orderId = Number(formData.get("orderId"));
  const status = String(formData.get("status") || "");
  if (!orderId || !status) return;
  await updateOrderStatusAction(orderId, status);
}

export async function setExpectedDeliveryFormAction(formData: FormData): Promise<void> {
  const orderId = Number(formData.get("orderId"));
  const date = String(formData.get("expectedDeliveryAt") || "").trim();
  if (!orderId) return;
  await setExpectedDeliveryAction(orderId, date);
}

export async function approveReviewFormAction(formData: FormData): Promise<void> {
  const reviewId = Number(formData.get("reviewId"));
  if (reviewId) await moderateReview(reviewId, "approved");
}

export async function hideReviewFormAction(formData: FormData): Promise<void> {
  const reviewId = Number(formData.get("reviewId"));
  if (reviewId) await moderateReview(reviewId, "hidden");
}

function lineItemsFromOrderItems(
  rows: { productId: number; variantId: number | null; quantity: number }[],
): StockLineItem[] {
  return rows.map((r) => ({ productId: r.productId, variantId: r.variantId ?? null, quantity: r.quantity }));
}

/**
 * Moves an order to a new status inside a transaction that also applies the
 * matching stock side-effect (finalize / release / restore) so reserved stock
 * never gets stuck.
 */
export async function updateOrderStatusAction(
  orderId: number,
  newStatus: string,
  note?: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "শুধুমাত্র অ্যাডমিন এই কাজটি করতে পারবেন।" };

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return { ok: false, message: "অর্ডারটি খুঁজে পাওয়া যায়নি।" };

  const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(newStatus)) {
    return { ok: false, message: `"${order.status}" থেকে "${newStatus}"-এ যাওয়া সম্ভব নয়।` };
  }

  const items = await db
    .select({ productId: orderItems.productId, variantId: orderItems.variantId, quantity: orderItems.quantity })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  await db.transaction(async (tx) => {
    // Stock side-effects
    if (newStatus === "cancelled") {
      await releaseReservedStock(tx, lineItemsFromOrderItems(items), admin.id);
    } else if (newStatus === "delivered") {
      await finalizeStockForOrder(tx, lineItemsFromOrderItems(items), admin.id);
    } else if (newStatus === "returned") {
      await restoreStockForReturn(tx, lineItemsFromOrderItems(items), admin.id);
    }

    // Payment bookkeeping for COD on delivery / refunds
    const paymentStatus =
      newStatus === "delivered"
        ? "successful"
        : newStatus === "refunded" || newStatus === "returned"
          ? "refunded"
          : newStatus === "failed"
            ? "failed"
            : undefined;

    await tx
      .update(orders)
      .set({
        status: newStatus,
        updatedAt: new Date(),
        ...(paymentStatus ? { paymentStatus } : {}),
      })
      .where(eq(orders.id, orderId));

    // Verified Buyer counter — only mutated inside this transaction so the
    // count can never drift from the real order states.
    if (newStatus === "delivered") {
      await applySuccessfulOrder(tx, order.userId);
    } else if ((newStatus === "returned" || newStatus === "refunded") && order.status === "delivered") {
      await reverseSuccessfulOrder(tx, order.userId);
    }

    await tx.insert(orderStatusHistory).values({
      orderId,
      status: newStatus,
      note: note?.trim() || null,
    });

    await tx.insert(notifications).values({
      userId: order.userId,
      audience: "customer",
      type: "order_status",
      title: "অর্ডার স্ট্যাটাস আপডেট",
      message: `আপনার অর্ডার ${order.orderNumber} এখন "${newStatus}" স্ট্যাটাসে আছে।`,
      link: `/my-orders/${order.orderNumber}`,
    });
  });

  await logAudit({
    adminId: admin.id,
    action: `order_status:${newStatus}`,
    entity: "order",
    entityId: String(orderId),
    oldValue: { status: order.status },
    newValue: { status: newStatus },
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${order.orderNumber}`);
  revalidatePath("/my-orders");
  revalidatePath(`/my-orders/${order.orderNumber}`);
  revalidatePath("/", "layout");
  return { ok: true, message: "অর্ডারের স্ট্যাটাস আপডেট করা হয়েছে।" };
}

async function moderateReview(reviewId: number, status: "approved" | "hidden"): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "শুধুমাত্র অ্যাডমিন এই কাজটি করতে পারবেন।" };

  const [review] = await db.select().from(reviews).where(eq(reviews.id, reviewId)).limit(1);
  if (!review) return { ok: false, message: "পর্যালোচনাটি খুঁজে পাওয়া যায়নি।" };

  await db.update(reviews).set({ status }).where(eq(reviews.id, reviewId));
  await recomputeProductRating(review.productId);

  const [product] = await db
    .select({ slug: products.slug })
    .from(products)
    .where(eq(products.id, review.productId))
    .limit(1);

  await logAudit({
    adminId: admin.id,
    action: `review_${status}`,
    entity: "review",
    entityId: String(reviewId),
  });

  if (product) {
    revalidatePath(`/products/${product.slug}`);
    revalidatePath("/products");
  }
  revalidatePath("/admin/reviews");
  return { ok: true, message: status === "approved" ? "পর্যালোচনাটি প্রকাশিত হয়েছে।" : "পর্যালোচনাটি লুকানো হয়েছে।" };
}

export async function approveReviewAction(reviewId: number): Promise<ActionResult> {
  return moderateReview(reviewId, "approved");
}

export async function hideReviewAction(reviewId: number): Promise<ActionResult> {
  return moderateReview(reviewId, "hidden");
}

export async function updateStoreSettingsAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin?denied=1");

  const num = (key: string): string | null => {
    const raw = formData.get(key);
    if (raw === null || String(raw).trim() === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? String(n) : null;
  };
  const str = (key: string): string | null => {
    const raw = formData.get(key);
    const v = raw === null ? "" : String(raw).trim();
    return v === "" ? null : v;
  };
  const bool = (key: string) => formData.get(key) === "on";

  const [existing] = await db.select().from(storeSettings).limit(1);

  const values = {
    storeName: str("storeName"),
    logo: str("logo"),
    phone: str("phone"),
    email: str("email"),
    address: str("address"),
    whatsapp: str("whatsapp"),
    facebook: str("facebook"),
    instagram: str("instagram"),
    insideDhakaFee: num("insideDhakaFee"),
    outsideDhakaFee: num("outsideDhakaFee"),
    freeShippingThreshold: num("freeShippingThreshold"),
    codEnabled: bool("codEnabled"),
    bkashEnabled: bool("bkashEnabled"),
    bkashNumber: str("bkashNumber"),
    nagadEnabled: bool("nagadEnabled"),
    nagadNumber: str("nagadNumber"),
    rocketEnabled: bool("rocketEnabled"),
    rocketNumber: str("rocketNumber"),
    maintenanceMode: bool("maintenanceMode"),
    metaDescription: str("metaDescription"),
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(storeSettings).set(values).where(eq(storeSettings.id, existing.id));
  } else {
    await db.insert(storeSettings).values(values);
  }

  await logAudit({
    adminId: admin.id,
    action: "settings_update",
    entity: "store_settings",
    entityId: existing ? String(existing.id) : null,
    oldValue: existing ? { maintenanceMode: existing.maintenanceMode } : null,
    newValue: { maintenanceMode: values.maintenanceMode },
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=1");
}

// ---------------------------------------------------------------------------
// BANNERS
// ---------------------------------------------------------------------------

export async function listBanners() {
  await assertAdmin();
  return db
    .select()
    .from(banners)
    .orderBy(banners.sortOrder, banners.createdAt);
}

export async function getBannerById(id: number) {
  await assertAdmin();
  const [row] = await db.select().from(banners).where(eq(banners.id, id)).limit(1);
  return row ?? null;
}

export async function createBannerAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "শুধুমাত্র অ্যাডমিন এই কাজটি করতে পারবেন।" };

  const str = (key: string): string | null => {
    const v = formData.get(key);
    const val = v === null ? "" : String(v).trim();
    return val === "" ? null : val;
  };
  const num = (key: string): number | null => {
    const v = formData.get(key);
    if (v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const bool = (key: string) => formData.get(key) === "on";

  // Upload image
  const imageFile = formData.get("image") as File | null;
  if (!imageFile || imageFile.size === 0) {
    return { ok: false, message: "ব্যানারের ছবি আবশ্যক।" };
  }
  if (imageFile.size > 10 * 1024 * 1024) {
    return { ok: false, message: "ছবির সাইজ ১০MB-এর কম হতে হবে।" };
  }

  let imageUrl: string;
  try {
    const uploaded = await uploadProductImage(imageFile, "banners");
    imageUrl = uploaded.url;
  } catch (e) {
    return { ok: false, message: describeUploadError(e) };
  }

  // Upload mobile image (optional)
  let mobileImageUrl: string | null = null;
  const mobileFile = formData.get("mobileImage") as File | null;
  if (mobileFile && mobileFile.size > 0) {
    try {
      const uploaded = await uploadProductImage(mobileFile, "banners");
      mobileImageUrl = uploaded.url;
    } catch (e) {
      return { ok: false, message: describeUploadError(e) };
    }
  }

  const [inserted] = await db
    .insert(banners)
    .values({
      title: str("title"),
      subtitle: str("subtitle"),
      image: imageUrl,
      mobileImage: mobileImageUrl,
      link: str("link"),
      section: str("section") || "hero",
      sortOrder: num("sortOrder") ?? 0,
      isActive: bool("isActive"),
      startDate: str("startDate") ? new Date(str("startDate")!) : null,
      endDate: str("endDate") ? new Date(str("endDate")!) : null,
    })
    .returning({ id: banners.id });

  await logAudit({
    adminId: admin.id,
    action: "banner_create",
    entity: "banner",
    entityId: String(inserted.id),
    newValue: { title: str("title"), section: str("section") },
  });

  revalidatePath("/admin/banners");
  revalidatePath("/", "layout");
  return { ok: true, message: "ব্যানার সফলভাবে তৈরি হয়েছে।", id: inserted.id };
}

export async function updateBannerAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "শুধুমাত্র অ্যাডমিন এই কাজটি করতে পারবেন।" };

  const bannerId = Number(formData.get("bannerId"));
  if (!bannerId) return { ok: false, message: "ব্যানার আইডি পাওয়া যায়নি।" };

  const [existing] = await db.select().from(banners).where(eq(banners.id, bannerId)).limit(1);
  if (!existing) return { ok: false, message: "ব্যানারটি খুঁজে পাওয়া যায়নি।" };

  const str = (key: string): string | null => {
    const v = formData.get(key);
    const val = v === null ? "" : String(v).trim();
    return val === "" ? null : val;
  };
  const num = (key: string): number | null => {
    const v = formData.get(key);
    if (v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const bool = (key: string) => formData.get(key) === "on";

  // Handle image replacement
  let imageUrl = existing.image;
  const imageFile = formData.get("image") as File | null;
  if (imageFile && imageFile.size > 0) {
    try {
      await deleteProductImage(existing.image);
    } catch { /* ignore */ }
    try {
      const uploaded = await uploadProductImage(imageFile, "banners");
      imageUrl = uploaded.url;
    } catch (e) {
      return { ok: false, message: describeUploadError(e) };
    }
  }

  // Handle mobile image
  let mobileImageUrl = existing.mobileImage;
  const mobileFile = formData.get("mobileImage") as File | null;
  if (mobileFile && mobileFile.size > 0) {
    if (existing.mobileImage) {
      try { await deleteProductImage(existing.mobileImage); } catch { /* ignore */ }
    }
    try {
      const uploaded = await uploadProductImage(mobileFile, "banners");
      mobileImageUrl = uploaded.url;
    } catch (e) {
      return { ok: false, message: describeUploadError(e) };
    }
  }

  await db
    .update(banners)
    .set({
      title: str("title"),
      subtitle: str("subtitle"),
      image: imageUrl,
      mobileImage: mobileImageUrl,
      link: str("link"),
      section: str("section") || "hero",
      sortOrder: num("sortOrder") ?? 0,
      isActive: bool("isActive"),
      startDate: str("startDate") ? new Date(str("startDate")!) : null,
      endDate: str("endDate") ? new Date(str("endDate")!) : null,
    })
    .where(eq(banners.id, bannerId));

  await logAudit({
    adminId: admin.id,
    action: "banner_update",
    entity: "banner",
    entityId: String(bannerId),
    oldValue: { title: existing.title, section: existing.section },
    newValue: { title: str("title"), section: str("section") },
  });

  revalidatePath("/admin/banners");
  revalidatePath("/", "layout");
  return { ok: true, message: "ব্যানার সফলভাবে আপডেট হয়েছে।", id: bannerId };
}

export async function deleteBannerAction(bannerId: number): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "শুধুমাত্র অ্যাডমিন এই কাজটি করতে পারবেন।" };

  const [existing] = await db.select().from(banners).where(eq(banners.id, bannerId)).limit(1);
  if (!existing) return { ok: false, message: "ব্যানারটি খুঁজে পাওয়া যায়নি।" };

  // Delete images from storage
  try { await deleteProductImage(existing.image); } catch { /* ignore */ }
  if (existing.mobileImage) {
    try { await deleteProductImage(existing.mobileImage); } catch { /* ignore */ }
  }

  await db.delete(banners).where(eq(banners.id, bannerId));

  await logAudit({
    adminId: admin.id,
    action: "banner_delete",
    entity: "banner",
    entityId: String(bannerId),
    oldValue: { title: existing.title, section: existing.section },
  });

  revalidatePath("/admin/banners");
  revalidatePath("/", "layout");
  return { ok: true, message: "ব্যানার মুছে ফেলা হয়েছে।" };
}

// ---------------------------------------------------------------------------
// CATEGORIES
// ---------------------------------------------------------------------------

async function uniqueCategorySlug(name: string, excludeId?: number): Promise<string> {
  const base = slugify(name) || `category-${Date.now().toString(36)}`;
  let candidate = base;
  let suffix = 2;
  for (;;) {
    const [row] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, candidate))
      .limit(1);
    if (!row || row.id === excludeId) return candidate;
    candidate = `${base}-${suffix++}`;
  }
}

export async function listCategories() {
  await assertAdmin();
  return db.select().from(categories).orderBy(categories.sortOrder, categories.name);
}

export async function getCategoryById(id: number) {
  await assertAdmin();
  const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return row ?? null;
}

export async function createCategoryAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "শুধুমাত্র অ্যাডমিন এই কাজটি করতে পারবেন।" };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "ক্যাটাগরির নাম আবশ্যক।" };

  // Optional image upload
  let imageUrl: string | null = null;
  const imageFile = formData.get("image") as File | null;
  if (imageFile && imageFile.size > 0) {
    if (imageFile.size > 10 * 1024 * 1024) {
      return { ok: false, message: "ছবির সাইজ ১০MB-এর কম হতে হবে।" };
    }
    try {
      const uploaded = await uploadProductImage(imageFile, "categories");
      imageUrl = uploaded.url;
    } catch (e) {
      return { ok: false, message: describeUploadError(e) };
    }
  }

  const num = (key: string): number | null => {
    const v = formData.get(key);
    if (v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const slug = await uniqueCategorySlug(String(formData.get("slug") ?? "") || name);

  const [inserted] = await db
    .insert(categories)
    .values({
      name,
      slug,
      image: imageUrl,
      sortOrder: num("sortOrder") ?? 0,
      isActive: formData.get("isActive") === "on",
    })
    .returning({ id: categories.id });

  await logAudit({
    adminId: admin.id,
    action: "category_create",
    entity: "category",
    entityId: String(inserted.id),
    newValue: { name, slug },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/new");
  revalidatePath("/", "layout");
  return { ok: true, message: "ক্যাটাগরি সফলভাবে তৈরি হয়েছে।", id: inserted.id };
}

export async function updateCategoryAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "শুধুমাত্র অ্যাডমিন এই কাজটি করতে পারবেন।" };

  const categoryId = Number(formData.get("categoryId"));
  if (!categoryId) return { ok: false, message: "ক্যাটাগরি আইডি পাওয়া যায়নি।" };

  const [existing] = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
  if (!existing) return { ok: false, message: "ক্যাটাগরিটি খুঁজে পাওয়া যায়নি।" };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "ক্যাটাগরির নাম আবশ্যক।" };

  // Handle image replacement
  let imageUrl = existing.image;
  const imageFile = formData.get("image") as File | null;
  if (imageFile && imageFile.size > 0) {
    if (imageFile.size > 10 * 1024 * 1024) {
      return { ok: false, message: "ছবির সাইজ ১০MB-এর কম হতে হবে।" };
    }
    if (existing.image) {
      try { await deleteProductImage(existing.image); } catch { /* ignore */ }
    }
    try {
      const uploaded = await uploadProductImage(imageFile, "categories");
      imageUrl = uploaded.url;
    } catch (e) {
      return { ok: false, message: describeUploadError(e) };
    }
  }

  const num = (key: string): number | null => {
    const v = formData.get(key);
    if (v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const slugInput = String(formData.get("slug") ?? "") || name;
  const slug = slugInput !== existing.name
    ? await uniqueCategorySlug(slugInput, categoryId)
    : existing.slug;

  await db
    .update(categories)
    .set({
      name,
      slug,
      image: imageUrl,
      sortOrder: num("sortOrder") ?? 0,
      isActive: formData.get("isActive") === "on",
    })
    .where(eq(categories.id, categoryId));

  await logAudit({
    adminId: admin.id,
    action: "category_update",
    entity: "category",
    entityId: String(categoryId),
    oldValue: { name: existing.name, slug: existing.slug },
    newValue: { name, slug },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/new");
  revalidatePath("/", "layout");
  return { ok: true, message: "ক্যাটাগরি সফলভাবে আপডেট হয়েছে।", id: categoryId };
}

export async function deleteCategoryAction(categoryId: number): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "শুধুমাত্র অ্যাডমিন এই কাজটি করতে পারবেন।" };

  const [existing] = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
  if (!existing) return { ok: false, message: "ক্যাটাগরিটি খুঁজে পাওয়া যায়নি।" };

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.categoryId, categoryId));

  if (existing.image) {
    try { await deleteProductImage(existing.image); } catch { /* ignore */ }
  }

  await db.delete(categories).where(eq(categories.id, categoryId));

  await logAudit({
    adminId: admin.id,
    action: "category_delete",
    entity: "category",
    entityId: String(categoryId),
    oldValue: { name: existing.name, slug: existing.slug },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/new");
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: count > 0
      ? `ক্যাটাগরি মুছে ফেলা হয়েছে। ${count} টি পণ্য ক্যাটাগরিবিহীন হয়ে গেছে।`
      : "ক্যাটাগরি মুছে ফেলা হয়েছে।",
  };
}

export async function toggleCategoryActiveAction(categoryId: number): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "শুধুমাত্র অ্যাডমিন এই কাজটি করতে পারবেন।" };

  const [existing] = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
  if (!existing) return { ok: false, message: "ক্যাটাগরিটি খুঁজে পাওয়া যায়নি।" };

  await db
    .update(categories)
    .set({ isActive: !existing.isActive })
    .where(eq(categories.id, categoryId));

  await logAudit({
    adminId: admin.id,
    action: "category_toggle",
    entity: "category",
    entityId: String(categoryId),
    oldValue: { isActive: existing.isActive },
    newValue: { isActive: !existing.isActive },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/new");
  revalidatePath("/", "layout");
  return { ok: true, message: !existing.isActive ? "ক্যাটাগরি সক্রিয় করা হয়েছে।" : "ক্যাটাগরি নিষ্ক্রিয় করা হয়েছে।" };
}

// ---------------------------------------------------------------------------
// FLASH SALES
// ---------------------------------------------------------------------------

export async function listFlashSales() {
  await assertAdmin();
  const sales = await db.select().from(flashSales).orderBy(desc(flashSales.startTime));
  const counts = await db
    .select({ flashSaleId: flashSaleItems.flashSaleId, count: sql<number>`count(*)::int` })
    .from(flashSaleItems)
    .groupBy(flashSaleItems.flashSaleId);
  const countMap = new Map(counts.map((c) => [c.flashSaleId, c.count]));
  return sales.map((s) => ({ ...s, itemCount: countMap.get(s.id) ?? 0 }));
}

export async function getFlashSaleById(id: number) {
  await assertAdmin();
  const [sale] = await db.select().from(flashSales).where(eq(flashSales.id, id)).limit(1);
  if (!sale) return null;
  const items = await db
    .select({
      productId: flashSaleItems.productId,
      discountPrice: flashSaleItems.discountPrice,
      stockLimit: flashSaleItems.stockLimit,
      soldCount: flashSaleItems.soldCount,
    })
    .from(flashSaleItems)
    .where(eq(flashSaleItems.flashSaleId, id));
  return { ...sale, items };
}

type FlashSaleItemInput = { productId: number; discountPrice: number; stockLimit: number };

function parseFlashSaleItems(raw: string): FlashSaleItemInput[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const items: FlashSaleItemInput[] = [];
    for (const entry of parsed) {
      const e = entry as Record<string, unknown>;
      const productId = Number(e.productId);
      const discountPrice = Number(e.discountPrice);
      const stockLimit = Number(e.stockLimit);
      if (!Number.isInteger(productId) || productId <= 0) return null;
      if (!Number.isFinite(discountPrice) || discountPrice <= 0) return null;
      if (!Number.isInteger(stockLimit) || stockLimit < 0) return null;
      items.push({ productId, discountPrice, stockLimit });
    }
    return items;
  } catch {
    return null;
  }
}

export async function createFlashSaleAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "শুধুমাত্র অ্যাডমিন এই কাজটি করতে পারবেন।" };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, message: "ফ্ল্যাশ সেলের শিরোনাম আবশ্যক।" };

  const startTime = new Date(String(formData.get("startTime") ?? ""));
  const endTime = new Date(String(formData.get("endTime") ?? ""));
  if (Number.isNaN(startTime.getTime())) return { ok: false, message: "শুরুর সময় সঠিক নয়।" };
  if (Number.isNaN(endTime.getTime())) return { ok: false, message: "শেষের সময় সঠিক নয়।" };
  if (endTime <= startTime) return { ok: false, message: "শেষের সময় শুরুর সময়ের পরে হতে হবে।" };

  const items = parseFlashSaleItems(String(formData.get("items") ?? "[]"));
  if (!items) return { ok: false, message: "পণ্য তালিকা সঠিক নয়।" };
  if (items.length === 0) return { ok: false, message: "অন্তত একটি পণ্য যোগ করুন।" };

  const saleId = await db.transaction(async (tx) => {
    const [sale] = await tx
      .insert(flashSales)
      .values({
        title,
        startTime,
        endTime,
        isActive: formData.get("isActive") === "on",
      })
      .returning({ id: flashSales.id });

    await tx.insert(flashSaleItems).values(
      items.map((it) => ({
        flashSaleId: sale.id,
        productId: it.productId,
        discountPrice: String(it.discountPrice),
        stockLimit: it.stockLimit,
      })),
    );

    return sale.id;
  });

  await logAudit({
    adminId: admin.id,
    action: "flash_sale_create",
    entity: "flash_sale",
    entityId: String(saleId),
    newValue: { title, startTime, endTime, itemCount: items.length },
  });

  revalidatePath("/admin/flash-sales");
  revalidatePath("/", "layout");
  return { ok: true, message: "ফ্ল্যাশ সেল সফলভাবে তৈরি হয়েছে।", id: saleId };
}

export async function updateFlashSaleAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "শুধুমাত্র অ্যাডমিন এই কাজটি করতে পারবেন।" };

  const saleId = Number(formData.get("saleId"));
  if (!saleId) return { ok: false, message: "ফ্ল্যাশ সেল আইডি পাওয়া যায়নি।" };

  const [existing] = await db.select().from(flashSales).where(eq(flashSales.id, saleId)).limit(1);
  if (!existing) return { ok: false, message: "ফ্ল্যাশ সেলটি খুঁজে পাওয়া যায়নি।" };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, message: "ফ্ল্যাশ সেলের শিরোনাম আবশ্যক।" };

  const startTime = new Date(String(formData.get("startTime") ?? ""));
  const endTime = new Date(String(formData.get("endTime") ?? ""));
  if (Number.isNaN(startTime.getTime())) return { ok: false, message: "শুরুর সময় সঠিক নয়।" };
  if (Number.isNaN(endTime.getTime())) return { ok: false, message: "শেষের সময় সঠিক নয়।" };
  if (endTime <= startTime) return { ok: false, message: "শেষের সময় শুরুর সময়ের পরে হতে হবে।" };

  const items = parseFlashSaleItems(String(formData.get("items") ?? "[]"));
  if (!items) return { ok: false, message: "পণ্য তালিকা সঠিক নয়।" };
  if (items.length === 0) return { ok: false, message: "অন্তত একটি পণ্য যোগ করুন।" };

  await db.transaction(async (tx) => {
    await tx
      .update(flashSales)
      .set({ title, startTime, endTime, isActive: formData.get("isActive") === "on" })
      .where(eq(flashSales.id, saleId));

    // Replace items wholesale; sold counts reset for removed/re-added products.
    await tx.delete(flashSaleItems).where(eq(flashSaleItems.flashSaleId, saleId));
    await tx.insert(flashSaleItems).values(
      items.map((it) => ({
        flashSaleId: saleId,
        productId: it.productId,
        discountPrice: String(it.discountPrice),
        stockLimit: it.stockLimit,
      })),
    );
  });

  await logAudit({
    adminId: admin.id,
    action: "flash_sale_update",
    entity: "flash_sale",
    entityId: String(saleId),
    oldValue: { title: existing.title },
    newValue: { title, startTime, endTime, itemCount: items.length },
  });

  revalidatePath("/admin/flash-sales");
  revalidatePath("/", "layout");
  return { ok: true, message: "ফ্ল্যাশ সেল সফলভাবে আপডেট হয়েছে।", id: saleId };
}

export async function deleteFlashSaleAction(saleId: number): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "শুধুমাত্র অ্যাডমিন এই কাজটি করতে পারবেন।" };

  const [existing] = await db.select().from(flashSales).where(eq(flashSales.id, saleId)).limit(1);
  if (!existing) return { ok: false, message: "ফ্ল্যাশ সেলটি খুঁজে পাওয়া যায়নি।" };

  await db.delete(flashSales).where(eq(flashSales.id, saleId)); // items cascade

  await logAudit({
    adminId: admin.id,
    action: "flash_sale_delete",
    entity: "flash_sale",
    entityId: String(saleId),
    oldValue: { title: existing.title },
  });

  revalidatePath("/admin/flash-sales");
  revalidatePath("/", "layout");
  return { ok: true, message: "ফ্ল্যাশ সেল মুছে ফেলা হয়েছে।" };
}

export async function toggleFlashSaleAction(saleId: number): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "শুধুমাত্র অ্যাডমিন এই কাজটি করতে পারবেন।" };

  const [existing] = await db.select().from(flashSales).where(eq(flashSales.id, saleId)).limit(1);
  if (!existing) return { ok: false, message: "ফ্ল্যাশ সেলটি খুঁজে পাওয়া যায়নি।" };

  await db.update(flashSales).set({ isActive: !existing.isActive }).where(eq(flashSales.id, saleId));

  await logAudit({
    adminId: admin.id,
    action: "flash_sale_toggle",
    entity: "flash_sale",
    entityId: String(saleId),
    oldValue: { isActive: existing.isActive },
    newValue: { isActive: !existing.isActive },
  });

  revalidatePath("/admin/flash-sales");
  revalidatePath("/", "layout");
  return { ok: true, message: !existing.isActive ? "ফ্ল্যাশ সেল সক্রিয় করা হয়েছে।" : "ফ্ল্যাশ সেল নিষ্ক্রিয় করা হয়েছে।" };
}

/**
 * One-way order message: admin → buyer. Buyers can READ these in
 * /account/messages but can never reply — conversation continues on
 * WhatsApp/Facebook only (phone calls are not accepted).
 */
export async function sendOrderMessageFormAction(formData: FormData): Promise<void> {
  const orderId = Number(formData.get("orderId"));
  const message = String(formData.get("message") || "").trim();
  if (!orderId || !message) return;
  await sendOrderMessageAction(orderId, message);
}

export async function sendOrderMessageAction(orderId: number, message: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "শুধুমাত্র অ্যাডমিন এই কাজটি করতে পারবেন।" };

  const text = message.trim().slice(0, 2000);
  if (!text) return { ok: false, message: "বার্তা লিখুন।" };

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return { ok: false, message: "অর্ডারটি খুঁজে পাওয়া যায়নি।" };

  await db.insert(orderMessages).values({
    orderId: order.id,
    sentByAdminId: admin.id,
    sentByName: admin.name,
    message: text,
  });

  // In-app notification so the buyer knows a message is waiting.
  await db.insert(notifications).values({
    userId: order.userId,
    audience: "customer",
    type: "order_message",
    title: `নতুন বার্তা — অর্ডার ${order.orderNumber}`,
    message: text.slice(0, 140),
    link: "/account/messages",
  });

  revalidatePath(`/admin/orders/${order.orderNumber}`);
  return { ok: true, message: "বার্তা পাঠানো হয়েছে।" };
}

/**
 * Admin manually fixes the expected (average) delivery date for an order.
 * An empty date clears it again. The buyer sees it on /my-orders/[orderNumber].
 */
export async function setExpectedDeliveryAction(orderId: number, dateStr: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "শুধুমাত্র অ্যাডমিন এই কাজটি করতে পারবেন।" };

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return { ok: false, message: "অর্ডারটি খুঁজে পাওয়া যায়নি।" };

  const trimmed = dateStr.trim();
  let expectedDeliveryAt: Date | null = null;
  if (trimmed) {
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, message: "সঠিক তারিখ নির্বাচন করুন।" };
    }
    expectedDeliveryAt = parsed;
  }

  await db
    .update(orders)
    .set({ expectedDeliveryAt, updatedAt: new Date() })
    .where(eq(orders.id, order.id));

  await logAudit({
    adminId: admin.id,
    action: expectedDeliveryAt ? "order_expected_delivery_set" : "order_expected_delivery_cleared",
    entity: "order",
    entityId: String(order.id),
    oldValue: { expectedDeliveryAt: order.expectedDeliveryAt?.toISOString() ?? null },
    newValue: { expectedDeliveryAt: expectedDeliveryAt?.toISOString() ?? null },
  });

  revalidatePath(`/admin/orders/${order.orderNumber}`);
  revalidatePath("/admin/orders");
  revalidatePath(`/my-orders/${order.orderNumber}`);
  return {
    ok: true,
    message: expectedDeliveryAt ? "প্রত্যাশিত ডেলিভারি তারিখ নির্ধারণ করা হয়েছে।" : "প্রত্যাশিত ডেলিভারি তারিখ মুছে ফেলা হয়েছে।",
  };
}
// ---------------------------------------------------------------------------
// DASHBOARD RESET (demo/test data wipe)
// ---------------------------------------------------------------------------

/**
 * Wipes all transactional demo data — orders (with items, status history and
 * delivery payments), reviews and notifications — so the store can start
 * fresh. Products, categories, users and settings are kept. Products ratings
 * are recomputed afterwards because every review disappears.
 */
export async function resetDashboardDataFormAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin?denied=1");

  // Typed confirmation — the button alone is not enough for a destructive wipe.
  if (String(formData.get("confirm") ?? "").trim() !== "RESET") return;

  await db.transaction(async (tx) => {
    // Children first (some are plain integer columns without FK cascade), then
    // orders — order_items and order_status_history cascade from orders.
    await tx.delete(orderMessages);
    await tx.delete(deliveryPayments);
    await tx.delete(reviews);
    await tx.delete(notifications);
    await tx.delete(orders);
  });

  // No reviews remain, so every product rating resets to zero.
  const allProducts = await db.select({ id: products.id }).from(products);
  await Promise.all(allProducts.map((p) => recomputeProductRating(p.id)));

  await logAudit({
    adminId: admin.id,
    action: "dashboard_reset",
    entity: "store",
    entityId: null,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/reviews");
}

/**
 * One-click status email to the buyer (order received / order verified).
 * Sends a branded HTML email via SMTP. Never throws.
 */
export async function sendOrderStatusEmailFormAction(formData: FormData): Promise<void> {
  await assertAdmin();
  const orderId = Number(formData.get("orderId"));
  const kind = String(formData.get("kind") || "received") === "verified" ? "verified" : "received";
  if (!orderId) return;
  const [row] = await db
    .select({ order: orders, buyerEmail: users.email })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!row || !row.buyerEmail) return;
  const [settings] = await db.select().from(storeSettings).limit(1);
  await sendOrderStatusEmail(
    {
      to: row.buyerEmail,
      recipientName: row.order.recipientName,
      orderNumber: row.order.orderNumber,
      orderDate: formatBanglaDate(row.order.createdAt),
      expectedDelivery: row.order.expectedDeliveryAt ? formatBanglaDate(row.order.expectedDeliveryAt) : null,
      storeName: settings?.storeName || "Markora",
    },
    kind,
  );
  revalidatePath(`/admin/orders/${row.order.orderNumber}`);
}
