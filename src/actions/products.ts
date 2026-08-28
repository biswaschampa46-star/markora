"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq, sql, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { products, categories } from "@/db/schema";
import { assertAdmin, requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { uploadProductImage, deleteProductImage, describeUploadError } from "@/lib/supabase";

type ActionResult = { ok: boolean; message: string; id?: number };

/** Detects PostgreSQL unique-constraint violations (error code 23505). */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

/**
 * Creates a new product (admin only).
 * Images are uploaded to Supabase Storage before the DB row is created.
 */
export async function createProductAction(
  prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "শুধুমাত্র অ্যাডমিন এই কাজটি করতে পারবেন।" };

  const get = (key: string) => {
    const v = formData.get(key);
    return v === null || v === "" ? null : String(v).trim();
  };
  const num = (key: string): number | null => {
    const v = formData.get(key);
    if (v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const bool = (key: string) => formData.get(key) === "on";

  const name = get("name");
  const slug = get("slug");
  const sku = get("sku");

  if (!name) return { ok: false, message: "পণ্যের নাম আবশ্যক।" };
  if (!slug) return { ok: false, message: "স্লাগ আবশ্যক।" };
  if (!sku) return { ok: false, message: "SKU আবশ্যক।" };

  const basePrice = num("basePrice");
  if (basePrice === null || basePrice < 0)
    return { ok: false, message: "সঠিক মূল্য দিন।" };

  // Upload thumbnail if provided
  let thumbnail: string | null = null;
  const thumbFile = formData.get("thumbnail") as File | null;
  if (thumbFile && thumbFile.size > 0) {
    try {
      const uploaded = await uploadProductImage(thumbFile, `products/${slug}`);
      thumbnail = uploaded.url;
    } catch (e) {
      return { ok: false, message: describeUploadError(e) };
    }
  }

  // Upload additional images
  const imageFiles = formData.getAll("images") as File[];
  const images: { url: string; alt?: string }[] = [];
  for (const img of imageFiles) {
    if (img && img.size > 0) {
      try {
        const uploaded = await uploadProductImage(img, `products/${slug}`);
        images.push({ url: uploaded.url, alt: name });
      } catch (e) {
        return { ok: false, message: describeUploadError(e) };
      }
    }
  }

  // Parse tags
  const tagsRaw = get("tags");
  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const categoryId = num("categoryId");
  const discountPrice = num("discountPrice");

  let inserted: { id: number };
  try {
    [inserted] = await db
      .insert(products)
      .values({
        name,
        slug,
        brand: get("brand"),
        categoryId: categoryId || null,
        shortDescription: get("shortDescription"),
        description: get("description"),
        sku,
        barcode: get("barcode"),
        weight: get("weight"),
        warranty: get("warranty"),
        returnEligible: bool("returnEligible"),
        condition: get("condition") || "new",
        tags,
        images,
        thumbnail,
        videoUrl: get("videoUrl"),
        basePrice: String(basePrice),
        discountPrice: discountPrice !== null ? String(discountPrice) : null,
        stock: num("stock") ?? 0,
        lowStockThreshold: num("lowStockThreshold") ?? 5,
        hasVariants: bool("hasVariants"),
        isActive: bool("isActive"),
        isFeatured: bool("isFeatured"),
        seoTitle: get("seoTitle"),
        seoDescription: get("seoDescription"),
      })
      .returning({ id: products.id });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, message: "এই স্লাগ বা SKU ইতিমধ্যে ব্যবহৃত হয়েছে। ভিন্ন নাম দিন।" };
    }
    throw err;
  }

  await logAudit({
    adminId: admin.id,
    action: "product_create",
    entity: "product",
    entityId: String(inserted.id),
    newValue: { name, sku, basePrice },
  });

  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/", "layout");
  redirect(`/admin/products/${inserted.id}`);
}

/**
 * Updates an existing product (admin only).
 */
export async function updateProductAction(
  prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "শুধুমাত্র অ্যাডমিন এই কাজটি করতে পারবেন।" };

  const productId = Number(formData.get("productId"));
  if (!productId) return { ok: false, message: "পণ্য আইডি পাওয়া যায়নি।" };

  const [existing] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!existing) return { ok: false, message: "পণ্যটি খুঁজে পাওয়া যায়নি।" };

  const get = (key: string) => {
    const v = formData.get(key);
    return v === null || v === "" ? null : String(v).trim();
  };
  const num = (key: string): number | null => {
    const v = formData.get(key);
    if (v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const bool = (key: string) => formData.get(key) === "on";

  const name = get("name");
  const slug = get("slug");
  const sku = get("sku");

  if (!name) return { ok: false, message: "পণ্যের নাম আবশ্যক।" };
  if (!slug) return { ok: false, message: "স্লাগ আবশ্যক।" };
  if (!sku) return { ok: false, message: "SKU আবশ্যক।" };

  const basePrice = num("basePrice");
  if (basePrice === null || basePrice < 0)
    return { ok: false, message: "সঠিক মূল্য দিন।" };

  // Handle thumbnail replacement
  let thumbnail = existing.thumbnail;
  const thumbFile = formData.get("thumbnail") as File | null;
  if (thumbFile && thumbFile.size > 0) {
    // Delete old thumbnail
    if (existing.thumbnail) {
      try { await deleteProductImage(existing.thumbnail); } catch { /* ignore */ }
    }
    try {
      const uploaded = await uploadProductImage(thumbFile, `products/${slug}`);
      thumbnail = uploaded.url;
    } catch (e) {
      return { ok: false, message: describeUploadError(e) };
    }
  }

  // Handle new images
  const imageFiles = formData.getAll("images") as File[];
  let images = existing.images;
  const newImages: { url: string; alt?: string }[] = [];
  for (const img of imageFiles) {
    if (img && img.size > 0) {
      try {
        const uploaded = await uploadProductImage(img, `products/${slug}`);
        newImages.push({ url: uploaded.url, alt: name });
      } catch (e) {
        return { ok: false, message: describeUploadError(e) };
      }
    }
  }
  if (newImages.length > 0) {
    images = [...images, ...newImages];
  }

  // Field present (even empty) → parse it, so admins can clear tags.
  // Field absent → keep existing tags.
  const tagsField = formData.get("tags");
  const tags =
    tagsField !== null
      ? String(tagsField)
          .trim()
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : existing.tags;

  const categoryId = num("categoryId");
  const discountPrice = num("discountPrice");

  try {
    await db
      .update(products)
      .set({
        name,
        slug,
        brand: get("brand"),
        categoryId: categoryId || null,
        shortDescription: get("shortDescription"),
        description: get("description"),
        sku,
        barcode: get("barcode"),
        weight: get("weight"),
        warranty: get("warranty"),
        returnEligible: bool("returnEligible"),
        condition: get("condition") || "new",
        tags,
        images,
        thumbnail,
        videoUrl: get("videoUrl"),
        basePrice: String(basePrice),
        discountPrice: discountPrice !== null ? String(discountPrice) : null,
        stock: num("stock") ?? 0,
        lowStockThreshold: num("lowStockThreshold") ?? 5,
        hasVariants: bool("hasVariants"),
        isActive: bool("isActive"),
        isFeatured: bool("isFeatured"),
        seoTitle: get("seoTitle"),
        seoDescription: get("seoDescription"),
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId));
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, message: "এই স্লাগ বা SKU ইতিমধ্যে অন্য পণ্যে ব্যবহৃত হয়েছে। ভিন্ন নাম দিন।" };
    }
    throw err;
  }

  await logAudit({
    adminId: admin.id,
    action: "product_update",
    entity: "product",
    entityId: String(productId),
    oldValue: { name: existing.name, sku: existing.sku },
    newValue: { name, sku },
  });

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/products/${slug}`);
  revalidatePath("/products");
  revalidatePath("/", "layout");
  return { ok: true, message: "পণ্য সফলভাবে আপডেট হয়েছে।", id: productId };
}

/**
 * Deletes a product (admin only).
 */
export async function deleteProductAction(productId: number): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "শুধুমাত্র অ্যাডমিন এই কাজটি করতে পারবেন।" };

  const [existing] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!existing) return { ok: false, message: "পণ্যটি খুঁজে পাওয়া যায়নি।" };

  // Delete images from Supabase Storage
  if (existing.thumbnail) {
    try { await deleteProductImage(existing.thumbnail); } catch { /* ignore */ }
  }
  for (const img of existing.images) {
    try { await deleteProductImage(img.url); } catch { /* ignore */ }
  }

  await db.delete(products).where(eq(products.id, productId));

  await logAudit({
    adminId: admin.id,
    action: "product_delete",
    entity: "product",
    entityId: String(productId),
    oldValue: { name: existing.name, sku: existing.sku },
  });

  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/", "layout");
  return { ok: true, message: "পণ্য মুছে ফেলা হয়েছে।" };
}

/**
 * Remove a single image from a product.
 */
export async function removeProductImageAction(
  productId: number,
  imageUrl: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "শুধুমাত্র অ্যাডমিন এই কাজটি করতে পারবেন।" };

  const [existing] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!existing) return { ok: false, message: "পণ্যটি খুঁজে পাওয়া যায়নি।" };

  // Delete from storage
  try { await deleteProductImage(imageUrl); } catch { /* ignore */ }

  const newImages = existing.images.filter((i) => i.url !== imageUrl);
  await db.update(products).set({ images: newImages, updatedAt: new Date() }).where(eq(products.id, productId));

  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, message: "ছবি মুছে ফেলা হয়েছে।" };
}

/**
 * List all products (admin, with search).
 */
export async function listAdminProducts(query?: string, page = 1, pageSize = 20) {
  await assertAdmin();

  const conditions = [];
  if (query) {
    const term = `%${query.trim()}%`;
    conditions.push(
      or(
        ilike(products.name, term),
        ilike(products.sku, term),
        ilike(products.brand, term),
      )!,
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(products)
      .where(whereClause)
      .orderBy(desc(products.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(whereClause),
  ]);

  const total = countRows[0]?.count ?? 0;

  return {
    items: rows,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
