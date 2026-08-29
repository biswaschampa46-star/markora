import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "নাম কমপক্ষে ২ অক্ষরের হতে হবে").max(120),
  email: z.string().trim().toLowerCase().email("সঠিক ইমেইল ঠিকানা দিন"),
  phone: z
    .string()
    .trim()
    .regex(/^01[3-9][0-9]{8}$/, "সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমনঃ 017XXXXXXXX)"),
  password: z.string().min(6, "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে").max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("সঠিক ইমেইল ঠিকানা দিন"),
  password: z.string().min(1, "পাসওয়ার্ড আবশ্যক"),
});

export const addressSchema = z.object({
  label: z.string().trim().min(1).max(40).default("বাসা"),
  recipientName: z.string().trim().min(2, "গ্রহীতার নাম আবশ্যক"),
  phone: z
    .string()
    .trim()
    .regex(/^01[3-9][0-9]{8}$/, "সঠিক বাংলাদেশি মোবাইল নম্বর দিন"),
  division: z.string().trim().min(1, "বিভাগ নির্বাচন করুন"),
  district: z.string().trim().min(1, "জেলা নির্বাচন করুন"),
  upazila: z.string().trim().optional().nullable(),
  addressLine: z.string().trim().min(5, "সম্পূর্ণ ঠিকানা লিখুন"),
  isDefault: z.boolean().optional().default(false),
});

export const checkoutSchema = z.object({
  addressId: z.number().int().positive().optional(),
  newAddress: addressSchema.optional(),
  paymentMethod: z.enum(["bkash", "nagad", "rocket", "cod"]),
  transactionId: z.string().trim().max(60).optional().nullable(),
  couponCode: z.string().trim().optional().nullable(),
  customerNote: z.string().trim().max(500).optional().nullable(),
});

export const reviewSchema = z.object({
  productId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional().nullable(),
});

export const cartAddSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().optional().nullable(),
  quantity: z.number().int().min(1).max(50).default(1),
  size: z.string().trim().min(1).max(20).optional().nullable(),
});

export const cartUpdateSchema = z.object({
  itemId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(50),
});

/**
 * Validates a post-login redirect target.
 *
 * A bare `startsWith("/")` check is not enough: `//evil.com` and `/\evil.com`
 * are protocol-relative URLs that browsers resolve to another origin, turning
 * the login form into an open redirect. Only same-origin single-slash paths pass.
 */
export function safeRedirectPath(value: unknown, fallback = "/account"): string {
  if (typeof value !== "string") return fallback;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return fallback;
  // Reject header/newline injection in the redirect target.
  if (path.includes("\n") || path.includes("\r")) return fallback;
  return path;
}
