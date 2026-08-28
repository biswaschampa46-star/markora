import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// USERS & AUTH
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("customer"), // customer | admin
    status: text("status").notNull().default("active"), // active | blocked
    avatar: text("avatar"),
    // Markora Verified Buyer program — server-side counters only, never
    // writable by clients. 3 successfully delivered orders => verified badge.
    successfulOrderCount: integer("successful_order_count").notNull().default(0),
    isVerifiedBuyer: boolean("is_verified_buyer").notNull().default(false),
    verifiedAt: timestamp("verified_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    index("users_role_idx").on(table.role),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_idx").on(table.token),
    index("sessions_user_idx").on(table.userId),
  ],
);

export const addresses = pgTable(
  "addresses",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull().default("বাসা"),
    recipientName: text("recipient_name").notNull(),
    phone: text("phone").notNull(),
    division: text("division").notNull(),
    district: text("district").notNull(),
    upazila: text("upazila"),
    addressLine: text("address_line").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("addresses_user_idx").on(table.userId)],
);

// ---------------------------------------------------------------------------
// CATALOG
// ---------------------------------------------------------------------------

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    parentId: integer("parent_id"),
    image: text("image"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("categories_slug_idx").on(table.slug),
    index("categories_parent_idx").on(table.parentId),
    index("categories_active_idx").on(table.isActive),
  ],
);

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    brand: text("brand"),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    shortDescription: text("short_description"),
    description: text("description"),
    sku: text("sku").notNull(),
    barcode: text("barcode"),
    weight: numeric("weight"),
    warranty: text("warranty"),
    returnEligible: boolean("return_eligible").notNull().default(true),
    condition: text("condition").notNull().default("new"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    images: jsonb("images").$type<{ url: string; alt?: string }[]>().notNull().default([]),
    thumbnail: text("thumbnail"),
    videoUrl: text("video_url"),
    basePrice: numeric("base_price").notNull(),
    discountPrice: numeric("discount_price"),
    stock: integer("stock").notNull().default(0),
    reservedStock: integer("reserved_stock").notNull().default(0),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    hasVariants: boolean("has_variants").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    avgRating: numeric("avg_rating").notNull().default("0"),
    reviewCount: integer("review_count").notNull().default(0),
    soldCount: integer("sold_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("products_slug_idx").on(table.slug),
    uniqueIndex("products_sku_idx").on(table.sku),
    index("products_category_idx").on(table.categoryId),
    index("products_active_idx").on(table.isActive),
    index("products_featured_idx").on(table.isFeatured),
    index("products_created_idx").on(table.createdAt),
  ],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    attributes: jsonb("attributes").$type<Record<string, string>>().notNull().default({}),
    sku: text("sku").notNull(),
    barcode: text("barcode"),
    price: numeric("price").notNull(),
    discountPrice: numeric("discount_price"),
    stock: integer("stock").notNull().default(0),
    reservedStock: integer("reserved_stock").notNull().default(0),
    image: text("image"),
    weight: numeric("weight"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("variants_sku_idx").on(table.sku),
    index("variants_product_idx").on(table.productId),
  ],
);

export const inventoryLogs = pgTable(
  "inventory_logs",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: integer("variant_id"),
    type: text("type").notNull(), // stock_in | stock_out | adjustment | order | cancel | return
    quantity: integer("quantity").notNull(),
    note: text("note"),
    adminId: integer("admin_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("inventory_logs_product_idx").on(table.productId)],
);

// ---------------------------------------------------------------------------
// CART / WISHLIST / RECENTLY VIEWED
// ---------------------------------------------------------------------------

export const cartItems = pgTable(
  "cart_items",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: integer("variant_id"),
    quantity: integer("quantity").notNull().default(1),
    savedForLater: boolean("saved_for_later").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("cart_items_user_idx").on(table.userId)],
);

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("wishlist_user_product_idx").on(table.userId, table.productId),
    index("wishlist_user_idx").on(table.userId),
  ],
);

export const recentlyViewed = pgTable(
  "recently_viewed",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("recently_viewed_user_product_idx").on(table.userId, table.productId),
  ],
);

// ---------------------------------------------------------------------------
// ORDERS
// ---------------------------------------------------------------------------

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    orderNumber: text("order_number").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("pending"),
    paymentMethod: text("payment_method").notNull(), // bkash | nagad | rocket | cod
    paymentStatus: text("payment_status").notNull().default("pending"),
    transactionId: text("transaction_id"),
    subtotal: numeric("subtotal").notNull(),
    discount: numeric("discount").notNull().default("0"),
    shippingFee: numeric("shipping_fee").notNull().default("0"),
    total: numeric("total").notNull(),
    couponCode: text("coupon_code"),
    recipientName: text("recipient_name").notNull(),
    phone: text("phone").notNull(),
    division: text("division").notNull(),
    district: text("district").notNull(),
    upazila: text("upazila"),
    addressLine: text("address_line").notNull(),
    customerNote: text("customer_note"),
    adminNote: text("admin_note"),
    expectedDeliveryAt: timestamp("expected_delivery_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("orders_order_number_idx").on(table.orderNumber),
    index("orders_user_idx").on(table.userId),
    index("orders_status_idx").on(table.status),
    index("orders_created_idx").on(table.createdAt),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull(),
    variantId: integer("variant_id"),
    productName: text("product_name").notNull(),
    variantName: text("variant_name"),
    image: text("image"),
    price: numeric("price").notNull(),
    quantity: integer("quantity").notNull(),
    total: numeric("total").notNull(),
  },
  (table) => [index("order_items_order_idx").on(table.orderId)],
);

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("order_status_history_order_idx").on(table.orderId)],
);

// ---------------------------------------------------------------------------
// REVIEWS
// ---------------------------------------------------------------------------

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orderId: integer("order_id"),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    // Optional photos the buyer attaches with the review (Supabase Storage URLs).
    imageUrl: text("image_url"),
    // Multiple photos per review (array of URLs). Kept alongside legacy
    // `image_url` for backward compatibility with older rows.
    imageUrls: jsonb("image_urls").$type<string[]>(),
    status: text("status").notNull().default("pending"), // pending | approved | hidden
    // How the status was decided: ai | wordlist | unavailable | admin
    moderationSource: text("moderation_source"),
    moderationReason: text("moderation_reason"),
    isVerifiedPurchase: boolean("is_verified_purchase").notNull().default(false),
    helpfulCount: integer("helpful_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("reviews_product_idx").on(table.productId),
    index("reviews_status_idx").on(table.status),
  ],
);

// ---------------------------------------------------------------------------
// COUPONS
// ---------------------------------------------------------------------------

export const coupons = pgTable(
  "coupons",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    type: text("type").notNull(), // percentage | fixed | free_shipping
    value: numeric("value").notNull().default("0"),
    minPurchase: numeric("min_purchase").notNull().default("0"),
    maxDiscount: numeric("max_discount"),
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    usageLimit: integer("usage_limit"),
    perUserLimit: integer("per_user_limit"),
    usedCount: integer("used_count").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    applicableCategoryIds: jsonb("applicable_category_ids").$type<number[]>().notNull().default([]),
    applicableProductIds: jsonb("applicable_product_ids").$type<number[]>().notNull().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("coupons_code_idx").on(table.code)],
);

export const couponUsages = pgTable(
  "coupon_usages",
  {
    id: serial("id").primaryKey(),
    couponId: integer("coupon_id")
      .notNull()
      .references(() => coupons.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull(),
    orderId: integer("order_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("coupon_usages_coupon_idx").on(table.couponId)],
);

// ---------------------------------------------------------------------------
// MARKETING: BANNERS / HOMEPAGE / FLASH SALE
// ---------------------------------------------------------------------------

export const banners = pgTable(
  "banners",
  {
    id: serial("id").primaryKey(),
    title: text("title"),
    subtitle: text("subtitle"),
    image: text("image").notNull(),
    mobileImage: text("mobile_image"),
    link: text("link"),
    section: text("section").notNull().default("hero"), // hero | promo
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("banners_section_idx").on(table.section)],
);

export const homepageSections = pgTable(
  "homepage_sections",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    title: text("title"),
    subtitle: text("subtitle"),
    isEnabled: boolean("is_enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [uniqueIndex("homepage_sections_key_idx").on(table.key)],
);

export const flashSales = pgTable("flash_sales", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const flashSaleItems = pgTable(
  "flash_sale_items",
  {
    id: serial("id").primaryKey(),
    flashSaleId: integer("flash_sale_id")
      .notNull()
      .references(() => flashSales.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    discountPrice: numeric("discount_price").notNull(),
    stockLimit: integer("stock_limit").notNull(),
    soldCount: integer("sold_count").notNull().default(0),
  },
  (table) => [index("flash_sale_items_sale_idx").on(table.flashSaleId)],
);

// ---------------------------------------------------------------------------
// SETTINGS / AUDIT / NOTIFICATIONS
// ---------------------------------------------------------------------------

export const storeSettings = pgTable("store_settings", {
  id: serial("id").primaryKey(),
  storeName: text("store_name"),
  logo: text("logo"),
  favicon: text("favicon"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  facebook: text("facebook"),
  instagram: text("instagram"),
  whatsapp: text("whatsapp"),
  insideDhakaFee: numeric("inside_dhaka_fee"),
  outsideDhakaFee: numeric("outside_dhaka_fee"),
  freeShippingThreshold: numeric("free_shipping_threshold"),
  codEnabled: boolean("cod_enabled").notNull().default(true),
  bkashEnabled: boolean("bkash_enabled").notNull().default(false),
  bkashNumber: text("bkash_number"),
  nagadEnabled: boolean("nagad_enabled").notNull().default(false),
  nagadNumber: text("nagad_number"),
  rocketEnabled: boolean("rocket_enabled").notNull().default(false),
  rocketNumber: text("rocket_number"),
  currencySymbol: text("currency_symbol").notNull().default("৳"),
  orderPrefix: text("order_prefix").notNull().default("ORD"),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  tradeLicense: text("trade_license"),
  vatBin: text("vat_bin"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    adminId: integer("admin_id"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("audit_logs_entity_idx").on(table.entity)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id"),
    audience: text("audience").notNull().default("customer"), // customer | admin
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    link: text("link"),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("notifications_user_idx").on(table.userId),
    index("notifications_audience_idx").on(table.audience),
  ],
);

// ---------------------------------------------------------------------------
// DELIVERY PRE-PAYMENTS (Verified Buyer program)
// ---------------------------------------------------------------------------

/**
 * Tracks the delivery-charge pre-payment every unverified buyer must make via
 * bKash/Nagad before their order is processed. The transaction_id is unique at
 * the database level, so a replayed/fake transaction ID can never be accepted
 * twice — the unique index is the final guard behind the application check.
 *
 * Rows are only ever written by the server (checkout) and only updated by an
 * authorized admin or a configured payment-gateway webhook; the client can
 * never flip a payment to "verified".
 */
export const deliveryPayments = pgTable(
  "delivery_payments",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    paymentMethod: text("payment_method").notNull(), // bkash | nagad | rocket
    transactionId: text("transaction_id").notNull(),
    deliveryCharge: numeric("delivery_charge").notNull().default("0"),
    paymentAmount: numeric("payment_amount").notNull().default("0"),
    paymentStatus: text("payment_status").notNull().default("pending"), // pending | verified | failed | refunded
    verificationMethod: text("verification_method"), // manual | auto (gateway API)
    adminNote: text("admin_note"),
    verifiedBy: integer("verified_by"),
    verifiedAt: timestamp("verified_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // Duplicate-transaction protection: one transaction ID can ever be
    // associated with exactly one payment record.
    uniqueIndex("delivery_payments_transaction_id_idx").on(table.transactionId),
    index("delivery_payments_user_idx").on(table.userId),
    index("delivery_payments_order_idx").on(table.orderId),
    index("delivery_payments_status_idx").on(table.paymentStatus),
  ],
);

// ---------------------------------------------------------------------------
// ORDER MESSAGES (one-way: admin → buyer)
// ---------------------------------------------------------------------------

export const orderMessages = pgTable(
  "order_messages",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    sentByAdminId: integer("sent_by_admin_id"),
    sentByName: text("sent_by_name"),
    message: text("message").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("order_messages_order_idx").on(table.orderId),
    index("order_messages_read_idx").on(table.isRead),
  ],
);
