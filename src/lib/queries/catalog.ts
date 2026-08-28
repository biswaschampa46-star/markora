import "server-only";
import { cache } from "react";
import { db } from "@/db";
import {
  banners,
  categories,
  flashSaleItems,
  flashSales,
  homepageSections,
  productVariants,
  products,
  reviews,
  users,
} from "@/db/schema";
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";

export type CategoryRow = typeof categories.$inferSelect;
export type ProductRow = typeof products.$inferSelect;

export const getActiveCategories = cache(async (): Promise<CategoryRow[]> => {
  return db
    .select()
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
});

export async function getCategoryTree() {
  const all = await getActiveCategories();
  const byParent = new Map<number | null, CategoryRow[]>();
  for (const cat of all) {
    const key = cat.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(cat);
  }
  const roots = byParent.get(null) ?? [];
  return roots.map((root) => ({ ...root, children: byParent.get(root.id) ?? [] }));
}

export async function getCategoryBySlug(slug: string) {
  const rows = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getActiveBanners(section: "hero" | "promo") {
  const now = new Date();
  const rows = await db
    .select()
    .from(banners)
    .where(
      and(
        eq(banners.section, section),
        eq(banners.isActive, true),
        or(isNull(banners.startDate), lte(banners.startDate, now)),
        or(isNull(banners.endDate), gte(banners.endDate, now)),
      ),
    )
    .orderBy(asc(banners.sortOrder));
  return rows;
}

export async function getHomepageSectionMap() {
  const rows = await db
    .select()
    .from(homepageSections)
    .where(eq(homepageSections.isEnabled, true))
    .orderBy(asc(homepageSections.sortOrder));
  const map = new Map<string, (typeof rows)[number]>();
  for (const row of rows) map.set(row.key, row);
  return map;
}

export async function getActiveFlashSale() {
  const now = new Date();

  // Single query: join flash_sales → flash_sale_items → products.
  const rows = await db
    .select({
      // sale columns
      saleId: flashSales.id,
      saleTitle: flashSales.title,
      saleStartTime: flashSales.startTime,
      saleEndTime: flashSales.endTime,
      // item columns
      itemId: flashSaleItems.id,
      discountPrice: flashSaleItems.discountPrice,
      stockLimit: flashSaleItems.stockLimit,
      soldCount: flashSaleItems.soldCount,
      // product columns (all)*
      product: products,
    })
    .from(flashSales)
    .innerJoin(flashSaleItems, eq(flashSaleItems.flashSaleId, flashSales.id))
    .innerJoin(products, eq(flashSaleItems.productId, products.id))
    .where(
      and(
        eq(flashSales.isActive, true),
        lte(flashSales.startTime, now),
        gte(flashSales.endTime, now),
        eq(products.isActive, true),
      ),
    );

  if (rows.length === 0) return null;

  // Reconstruct the sale object from the first row.
  const first = rows[0];
  const sale = {
    id: first.saleId,
    title: first.saleTitle,
    startTime: first.saleStartTime,
    endTime: first.saleEndTime,
  };

  const items = rows.map((r) => ({
    id: r.itemId,
    discountPrice: r.discountPrice,
    stockLimit: r.stockLimit,
    soldCount: r.soldCount,
    product: r.product,
  }));

  return { sale, items };
}

export async function getFeaturedProducts(limit = 8) {
  return db
    .select()
    .from(products)
    .where(and(eq(products.isActive, true), eq(products.isFeatured, true)))
    .orderBy(desc(products.createdAt))
    .limit(limit);
}

export async function getNewArrivals(limit = 8) {
  return db
    .select()
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(desc(products.createdAt))
    .limit(limit);
}

export async function getBestSellers(limit = 8) {
  return db
    .select()
    .from(products)
    .where(and(eq(products.isActive, true), sql`${products.soldCount} > 0`))
    .orderBy(desc(products.soldCount))
    .limit(limit);
}

export async function getDiscountedProducts(limit = 8) {
  return db
    .select()
    .from(products)
    .where(and(eq(products.isActive, true), sql`${products.discountPrice} is not null`))
    .orderBy(desc(products.createdAt))
    .limit(limit);
}

export type ProductListFilters = {
  q?: string;
  categorySlug?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  discountOnly?: boolean;
  sort?: string;
  page?: number;
  pageSize?: number;
};

export async function listProducts(filters: ProductListFilters) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 20;

  const conditions = [eq(products.isActive, true)];

  if (filters.categorySlug) {
    const cat = await getCategoryBySlug(filters.categorySlug);
    if (cat) {
      const children = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.parentId, cat.id));
      const ids = [cat.id, ...children.map((c) => c.id)];
      conditions.push(inArray(products.categoryId, ids));
    } else {
      conditions.push(sql`false`);
    }
  }

  if (filters.q) {
    const term = `%${filters.q.trim()}%`;
    conditions.push(
      or(
        ilike(products.name, term),
        ilike(products.brand, term),
        ilike(products.sku, term),
        sql`${products.tags}::text ilike ${term}`,
      )!,
    );
  }

  if (filters.brand) {
    conditions.push(eq(products.brand, filters.brand));
  }

  if (filters.minPrice !== undefined) {
    conditions.push(sql`coalesce(${products.discountPrice}, ${products.basePrice}) >= ${filters.minPrice}`);
  }
  if (filters.maxPrice !== undefined) {
    conditions.push(sql`coalesce(${products.discountPrice}, ${products.basePrice}) <= ${filters.maxPrice}`);
  }
  if (filters.minRating !== undefined) {
    conditions.push(gte(products.avgRating, String(filters.minRating)));
  }
  if (filters.discountOnly) {
    conditions.push(sql`${products.discountPrice} is not null`);
  }

  let orderBy = desc(products.createdAt);
  switch (filters.sort) {
    case "price_asc":
      orderBy = sql`coalesce(${products.discountPrice}, ${products.basePrice}) asc` as unknown as typeof orderBy;
      break;
    case "price_desc":
      orderBy = sql`coalesce(${products.discountPrice}, ${products.basePrice}) desc` as unknown as typeof orderBy;
      break;
    case "popularity":
      orderBy = desc(products.soldCount);
      break;
    case "rating":
      orderBy = desc(products.avgRating);
      break;
    case "discount":
      orderBy = sql`(case when ${products.discountPrice} is not null then (${products.basePrice} - ${products.discountPrice}) / ${products.basePrice} else 0 end) desc` as unknown as typeof orderBy;
      break;
    case "newest":
    default:
      orderBy = desc(products.createdAt);
  }

  const whereClause = and(...conditions);

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(products)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(whereClause),
  ]);

  const total = countRows[0]?.count ?? 0;

  return {
    items: rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getDistinctBrands() {
  const rows = await db
    .select({ brand: products.brand })
    .from(products)
    .where(and(eq(products.isActive, true), sql`${products.brand} is not null`))
    .groupBy(products.brand);
  return rows.map((r) => r.brand).filter(Boolean) as string[];
}

export async function getProductBySlug(slug: string) {
  const rows = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getProductById(id: number) {
  const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getRelatedProducts(product: ProductRow, limit = 8) {
  if (!product.categoryId) return [];
  return db
    .select()
    .from(products)
    .where(
      and(
        eq(products.isActive, true),
        eq(products.categoryId, product.categoryId),
        sql`${products.id} != ${product.id}`,
      ),
    )
    .orderBy(desc(products.soldCount))
    .limit(limit);
}

export async function hasUserReviewed(userId: number, productId: number) {
  const rows = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

export async function getProductVariants(productId: number) {
  return db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.productId, productId), eq(productVariants.isActive, true)));
}

export async function getApprovedReviews(productId: number, page = 1, pageSize = 10) {
  const whereClause = and(eq(reviews.productId, productId), eq(reviews.status, "approved"));
  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        imageUrl: reviews.imageUrl,
        imageUrls: reviews.imageUrls,
        isVerifiedPurchase: reviews.isVerifiedPurchase,
        createdAt: reviews.createdAt,
        userName: users.name,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .where(whereClause)
      .orderBy(desc(reviews.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(reviews).where(whereClause),
  ]);
  return { items: rows, total: countRows[0]?.count ?? 0 };
}
