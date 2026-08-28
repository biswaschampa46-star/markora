import "server-only";
import { and, asc, count, desc, eq, gt, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, orderItems, orders, products, users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth";
import { computePrice, availableStock } from "@/lib/pricing";
import type { ProductCard } from "./config";

/**
 * OpenRouter function-calling tools backed by Drizzle (direct DB access —
 * replaces the removed Cloudflare worker's Supabase PostgREST queries).
 * All queries are read-only; row caps keep the model from pulling the catalog.
 */

const MAX_ROWS = 8;
const MAX_TOOL_RESULT_CHARS = 6000;

export const AI_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_products",
      description:
        "Search the product catalog by category name/slug, max budget (BDT) and/or free-text keywords. Returns matching products.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Category name or slug, e.g. 'electronics'. Optional." },
          max_budget: { type: "number", description: "Maximum effective price in BDT. Optional." },
          query: { type: "string", description: "Free-text keywords matched against name/brand/tags. Optional." },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "recommend_products",
      description:
        "Curated product recommendations for open-ended asks like 'gift under 1000 taka for mom'. priority: rating | discount | newest.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Optional category name or slug." },
          budget_max: { type: "number", description: "Optional max price in BDT." },
          priority: { type: "string", enum: ["rating", "discount", "newest"] },
          use_case: { type: "string", description: "Short use-case note keyword-filtered against names/tags. Optional." },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_customer_orders",
      description:
        "Get the CURRENT logged-in customer's recent 10 orders. Takes no arguments — identity is resolved server-side from the session.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_order_details",
      description:
        "Get full details of one order by order number (items, status, payment, address summary). Customers may only look up their OWN orders; store admins may look up any order.",
      parameters: {
        type: "object",
        properties: {
          order_number: { type: "string", description: "Order number, e.g. 'MK-260827-067704'." },
        },
        required: ["order_number"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_store_analytics",
      description:
        "ADMIN ONLY: full website overview — total revenue, order counts by status, product/category/customer counts and best sellers. Rejects non-admin callers.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

type ToolProduct = ProductCard & { stockStatus: "in_stock" | "out_of_stock" };

export type AiToolResult =
  | { ok: true; count: number; products: ToolProduct[] }
  | {
      ok: true;
      count: number;
      orders: { orderNumber: string; status: string; paymentMethod: string; totalBdt: number; placedAt: string }[];
    }
  | {
      ok: true;
      order: {
        orderNumber: string;
        status: string;
        paymentMethod: string;
        paymentStatus: string;
        totalBdt: number;
        placedAt: string;
        recipientName: string;
        district: string;
        items: { name: string; quantity: number; totalBdt: number }[];
      };
    }
  | {
      ok: true;
      analytics: {
        totalOrders: number;
        revenueBdt: number;
        ordersByStatus: Record<string, number>;
        activeProducts: number;
        categories: number;
        customers: number;
        bestSellers: { name: string; sold: number; priceBdt: number }[];
      };
    }
  | { ok: false; error: string };

function toToolProduct(row: typeof products.$inferSelect): ToolProduct {
  const price = computePrice(row);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    thumbnail: row.thumbnail,
    price: price.price,
    originalPrice: price.originalPrice,
    stockStatus: availableStock(row.stock, row.reservedStock) > 0 ? "in_stock" : "out_of_stock",
  };
}

/** Strip LIKE wildcards — the model echoes user text into tool args. */
function cleanKeyword(term: string): string {
  return term.replace(/[%_]/g, "").trim();
}

async function resolveCategoryIds(nameOrSlug: string): Promise<number[]> {
  const term = `%${cleanKeyword(nameOrSlug)}%`;
  const cats = await db
    .select({ id: categories.id })
    .from(categories)
    .where(or(ilike(categories.name, term), ilike(categories.slug, term))!)
    .limit(1);
  if (cats.length === 0) return [];
  const children = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.parentId, cats[0].id));
  return [cats[0].id, ...children.map((c) => c.id)];
}

const effectivePrice = sql`coalesce(${products.discountPrice}, ${products.basePrice})`;

async function searchProducts(args: {
  category?: unknown;
  max_budget?: unknown;
  query?: unknown;
}): Promise<AiToolResult> {
  const conditions = [eq(products.isActive, true)];

  const budget = Number(args.max_budget);
  if (args.max_budget != null && !Number.isNaN(budget)) {
    conditions.push(sql`${effectivePrice} <= ${budget}`);
  }

  const query = typeof args.query === "string" ? cleanKeyword(args.query) : "";
  if (query) {
    const term = `%${query}%`;
    conditions.push(
      or(
        ilike(products.name, term),
        ilike(products.brand, term),
        sql`${products.tags}::text ilike ${term}`,
      )!,
    );
  }

  const category = typeof args.category === "string" && args.category.trim() ? args.category.trim() : null;
  if (category) {
    const categoryIds = await resolveCategoryIds(category);
    if (categoryIds.length > 0) {
      conditions.push(inArray(products.categoryId, categoryIds));
    }
  }

  const rows = await db
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(asc(effectivePrice))
    .limit(MAX_ROWS);

  return { ok: true, count: rows.length, products: rows.map(toToolProduct) };
}

async function recommendProducts(args: {
  category?: unknown;
  budget_max?: unknown;
  priority?: unknown;
  use_case?: unknown;
}): Promise<AiToolResult> {
  const conditions = [eq(products.isActive, true), gt(products.stock, 0)];

  const budget = Number(args.budget_max);
  const hasBudget = args.budget_max != null && !Number.isNaN(budget);
  if (hasBudget) conditions.push(sql`${effectivePrice} <= ${budget}`);

  const priority = typeof args.priority === "string" ? args.priority : "rating";
  const orderBy =
    priority === "discount"
      ? desc(products.soldCount)
      : priority === "newest"
        ? desc(products.createdAt)
        : desc(products.avgRating);

  const runQuery = () =>
    db.select().from(products).where(and(...conditions)).orderBy(orderBy).limit(MAX_ROWS);

  // Some filter+order combos can fail — retry once without the budget filter.
  let rows = await runQuery().catch(() => {
    if (!hasBudget) throw new Error("recommend query failed");
    conditions.pop();
    return runQuery();
  });

  const useCase = typeof args.use_case === "string" ? cleanKeyword(args.use_case).toLowerCase() : "";
  const keyword = useCase ? useCase.split(/\s+/)[0] : "";
  if (keyword) {
    const filtered = rows.filter((p) =>
      `${p.name} ${(p.tags ?? []).join(" ")}`.toLowerCase().includes(keyword),
    );
    if (filtered.length > 0) rows = filtered;
  }

  return { ok: true, count: rows.length, products: rows.map(toToolProduct) };
}

async function getCustomerOrders(user: SessionUser | null): Promise<AiToolResult> {
  if (!user?.id) {
    return { ok: false, error: "লগইন করা অবস্থায় শুধুমাত্র আপনার অর্ডার দেখা যাবে।" };
  }
  const rows = await db
    .select({
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      total: orders.total,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.userId, user.id))
    .orderBy(desc(orders.createdAt))
    .limit(10);

  return {
    ok: true,
    count: rows.length,
    orders: rows.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      paymentMethod: o.paymentMethod,
      totalBdt: Number(o.total),
      placedAt: o.createdAt.toISOString(),
    })),
  };
}

async function getOrderDetails(args: { order_number?: unknown }, user: SessionUser | null): Promise<AiToolResult> {
  const orderNumber = typeof args.order_number === "string" ? args.order_number.trim() : "";
  if (!orderNumber) return { ok: false, error: "অর্ডার নম্বর প্রয়োজন।" };
  if (!user?.id) return { ok: false, error: "অর্ডার বিবরণ দেখতে লগইন করুন।" };

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  if (!order) return { ok: false, error: "এই নম্বরে কোনো অর্ডার পাওয়া যায়নি।" };

  // Customers may only inspect their own orders; admins see everything.
  if (user.role !== "admin" && order.userId !== user.id) {
    return { ok: false, error: "এই অর্ডারটি আপনার নয়।" };
  }

  const items = await db
    .select({
      productName: orderItems.productName,
      quantity: orderItems.quantity,
      total: orderItems.total,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  return {
    ok: true,
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      totalBdt: Number(order.total),
      placedAt: order.createdAt.toISOString(),
      recipientName: order.recipientName,
      district: order.district,
      items: items.map((i) => ({ name: i.productName, quantity: i.quantity, totalBdt: Number(i.total) })),
    },
  };
}

async function getStoreAnalytics(user: SessionUser | null): Promise<AiToolResult> {
  if (user?.role !== "admin") {
    return { ok: false, error: "এই তথ্য শুধুমাত্র স্টোর অ্যাডমিনের জন্য।" };
  }

  const statusRows = await db
    .select({ status: orders.status, total: count() })
    .from(orders)
    .groupBy(orders.status);

  const [revenueRow] = await db
    .select({ revenue: sql<string>`COALESCE(SUM(${orders.total}), 0)` })
    .from(orders)
    .where(inArray(orders.status, ["confirmed", "processing", "shipped", "delivered"]));

  const [productRow, categoryRow, customerRow] = await Promise.all([
    db.select({ total: count() }).from(products).where(eq(products.isActive, true)),
    db.select({ total: count() }).from(categories).where(eq(categories.isActive, true)),
    db.select({ total: count() }).from(users).where(eq(users.role, "customer")),
  ]);

  const bestSellers = await db
    .select({
      name: products.name,
      sold: products.soldCount,
      price: products.discountPrice,
      basePrice: products.basePrice,
    })
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(desc(products.soldCount))
    .limit(5);

  return {
    ok: true,
    analytics: {
      totalOrders: statusRows.reduce((sum, r) => sum + Number(r.total), 0),
      revenueBdt: Number(revenueRow?.revenue ?? 0),
      ordersByStatus: Object.fromEntries(statusRows.map((r) => [r.status, Number(r.total)])),
      activeProducts: Number(productRow[0]?.total ?? 0),
      categories: Number(categoryRow[0]?.total ?? 0),
      customers: Number(customerRow[0]?.total ?? 0),
      bestSellers: bestSellers.map((p) => ({
        name: p.name,
        sold: p.sold,
        priceBdt: Number(p.price ?? p.basePrice),
      })),
    },
  };
}

/**
 * Executes one tool call. Never throws — every failure becomes a structured
 * error so the assistant message's tool_call_id always gets a matching tool
 * message back (required by the OpenAI-compatible chat format).
 */
export async function executeAiTool(
  name: string,
  argsRaw: string,
  user: SessionUser | null,
): Promise<AiToolResult> {
  try {
    let args: Record<string, unknown> = {};
    if (argsRaw && argsRaw.trim()) {
      try {
        args = JSON.parse(argsRaw) as Record<string, unknown>;
      } catch {
        args = {};
      }
    }

    switch (name) {
      case "search_products":
        return await searchProducts(args);
      case "recommend_products":
        return await recommendProducts(args);
      case "get_customer_orders":
        return await getCustomerOrders(user);
      case "get_order_details":
        return await getOrderDetails(args, user);
      case "get_store_analytics":
        return await getStoreAnalytics(user);
      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    console.error(`[ai/tools] ${name} failed:`, err);
    return { ok: false, error: "ডেটাবেজ কোয়েরি ব্যর্থ হয়েছে।" };
  }
}
