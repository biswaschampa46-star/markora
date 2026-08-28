"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { cartItems, productVariants, products } from "@/db/schema";
import { getCurrentUser, type SessionUser } from "@/lib/auth";
import { availableStock } from "@/lib/pricing";
import { cartAddSchema, cartUpdateSchema } from "@/lib/validation";

type ActionResult = { ok: boolean; message: string; requireLogin?: boolean };

/** Hard ceiling on units of one line item, mirrored in the zod schemas. */
const MAX_QUANTITY_PER_ITEM = 50;

const SESSION_EXPIRED: ActionResult = {
  ok: false,
  message: "আপনার সেশন শেষ হয়ে গেছে। আবার লগইন করুন।",
  requireLogin: true,
};

const ACCOUNT_BLOCKED: ActionResult = {
  ok: false,
  message: "আপনার অ্যাকাউন্টটি সাময়িকভাবে ব্লক করা হয়েছে।",
};

/**
 * Resolves the active buyer for a cart mutation.
 *
 * Every cart action needs the same two checks, and a blocked account must not
 * be able to keep shopping - previously only `addToCartAction` enforced that.
 */
async function activeBuyer(): Promise<{ user: SessionUser } | { error: ActionResult }> {
  const user = await getCurrentUser();
  if (!user) return { error: SESSION_EXPIRED };
  if (user.status !== "active") return { error: ACCOUNT_BLOCKED };
  return { user };
}

/** Revalidates every surface that renders cart contents or its badge count. */
function revalidateCart(): void {
  revalidatePath("/", "layout");
  revalidatePath("/cart");
}

export async function addToCartAction(
  productId: number,
  variantId: number | null,
  quantity: number,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, message: "কার্টে যোগ করতে অনুগ্রহ করে লগইন করুন।", requireLogin: true };
  }
  if (user.status !== "active") return ACCOUNT_BLOCKED;

  // Server actions are public endpoints: the arguments arrive over the wire and
  // are not constrained by whatever the UI sent. Without this, a negative or
  // fractional quantity flows straight into the row.
  const parsed = cartAddSchema.safeParse({ productId, variantId, quantity });
  if (!parsed.success) {
    return { ok: false, message: "অনুরোধটি সঠিক নয়।" };
  }
  ({ productId, variantId, quantity } = {
    ...parsed.data,
    variantId: parsed.data.variantId ?? null,
  });

  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!product || !product.isActive) {
    return { ok: false, message: "এই পণ্যটি বর্তমানে উপলভ্য নয়।" };
  }

  let stock = availableStock(product.stock, product.reservedStock);
  let variant = null;
  if (variantId) {
    const [v] = await db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)))
      .limit(1);
    if (!v || !v.isActive) {
      return { ok: false, message: "নির্বাচিত ভ্যারিয়েন্টটি উপলভ্য নয়।" };
    }
    variant = v;
    stock = availableStock(v.stock, v.reservedStock);
  } else if (product.hasVariants) {
    return { ok: false, message: "অনুগ্রহ করে একটি ভ্যারিয়েন্ট নির্বাচন করুন।" };
  }

  if (stock <= 0) {
    return { ok: false, message: "স্টক শেষ।" };
  }

  // Match the exact line: same product AND same variant (or no variant).
  const [matched] = await db
    .select()
    .from(cartItems)
    .where(
      and(
        eq(cartItems.userId, user.id),
        eq(cartItems.productId, productId),
        variant ? eq(cartItems.variantId, variant.id) : isNull(cartItems.variantId),
        eq(cartItems.savedForLater, false),
      ),
    )
    .limit(1);

  const desiredQuantity = (matched?.quantity ?? 0) + quantity;
  const finalQuantity = Math.min(desiredQuantity, stock, MAX_QUANTITY_PER_ITEM);

  if (matched) {
    await db
      .update(cartItems)
      .set({ quantity: finalQuantity, updatedAt: new Date() })
      .where(eq(cartItems.id, matched.id));
  } else {
    await db.insert(cartItems).values({
      userId: user.id,
      productId,
      variantId: variant?.id ?? null,
      quantity: finalQuantity,
    });
  }

  revalidateCart();

  return { ok: true, message: "পণ্যটি কার্টে যোগ করা হয়েছে।" };
}

export async function updateCartQuantityAction(itemId: number, quantity: number): Promise<ActionResult> {
  const auth = await activeBuyer();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const parsed = cartUpdateSchema.safeParse({ itemId, quantity });
  if (!parsed.success) {
    return { ok: false, message: `পরিমাণ ১ থেকে ${MAX_QUANTITY_PER_ITEM} এর মধ্যে হতে হবে।` };
  }
  ({ itemId, quantity } = parsed.data);

  const [item] = await db
    .select({ cartItem: cartItems, product: products, variant: productVariants })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .leftJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .where(and(eq(cartItems.id, itemId), eq(cartItems.userId, user.id)));

  if (!item) return { ok: false, message: "পণ্যটি কার্টে পাওয়া যায়নি।" };

  const stock = item.variant
    ? availableStock(item.variant.stock, item.variant.reservedStock)
    : availableStock(item.product.stock, item.product.reservedStock);

  if (quantity > stock) {
    return { ok: false, message: `দুঃখিত, সর্বোচ্চ ${stock} টি পণ্য স্টকে রয়েছে।` };
  }

  // Ownership is already proven by the scoped select above.
  await db
    .update(cartItems)
    .set({ quantity, updatedAt: new Date() })
    .where(and(eq(cartItems.id, itemId), eq(cartItems.userId, user.id)));

  revalidateCart();
  return { ok: true, message: "কার্ট আপডেট করা হয়েছে।" };
}

export async function removeCartItemAction(itemId: number): Promise<ActionResult> {
  const auth = await activeBuyer();
  if ("error" in auth) return auth.error;

  // Scoping the delete by userId is what prevents deleting someone else's row.
  await db.delete(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.userId, auth.user.id)));

  revalidateCart();
  return { ok: true, message: "পণ্যটি কার্ট থেকে সরানো হয়েছে।" };
}

export async function moveToSavedAction(itemId: number, saved: boolean): Promise<ActionResult> {
  const auth = await activeBuyer();
  if ("error" in auth) return auth.error;

  await db
    .update(cartItems)
    .set({ savedForLater: Boolean(saved), updatedAt: new Date() })
    .where(and(eq(cartItems.id, itemId), eq(cartItems.userId, auth.user.id)));

  revalidateCart();
  return { ok: true, message: saved ? "পরে কেনার জন্য সংরক্ষণ করা হয়েছে।" : "পণ্যটি পুনরায় কার্টে যোগ করা হয়েছে।" };
}
