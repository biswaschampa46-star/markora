"use server";

import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { headers } from "next/headers";
import {
  burnPasswordCompare,
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { loginSchema, registerSchema, safeRedirectPath } from "@/lib/validation";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { redirect } from "next/navigation";

/** Detects PostgreSQL unique-constraint violations (SQLSTATE 23505). */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

export type AuthState = { error?: string } | null;

/** Credential-stuffing budget: attempts per IP per window. */
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
/** Signup abuse budget — bcrypt at cost 12 makes this expensive to spam. */
const REGISTER_MAX_ATTEMPTS = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;

/** Same message for every credential failure — never reveal which half was wrong. */
const INVALID_CREDENTIALS = "ইমেইল বা পাসওয়ার্ড সঠিক নয়।";
const TOO_MANY_ATTEMPTS = "অনেক বেশি চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।";

/** Server actions have no `Request` object; rebuild the minimum the IP helper needs. */
async function clientIp(): Promise<string> {
  try {
    const hdrs = await headers();
    return getClientIp(new Request("http://internal", { headers: hdrs }));
  } catch {
    return "unknown";
  }
}

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const ip = await clientIp();
  if (rateLimit(`register:${ip}`, REGISTER_MAX_ATTEMPTS, REGISTER_WINDOW_MS).limited) {
    return { error: TOO_MANY_ATTEMPTS };
  }

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়।" };
  }

  const { name, email, phone, password } = parsed.data;

  // One round-trip for both uniqueness checks instead of two sequential ones.
  const clashes = await db
    .select({ email: users.email, phone: users.phone })
    .from(users)
    .where(or(eq(users.email, email), eq(users.phone, phone)))
    .limit(2);

  if (clashes.some((row) => row.email === email)) {
    return { error: "এই ইমেইল দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট রয়েছে।" };
  }
  if (clashes.some((row) => row.phone === phone)) {
    return { error: "এই মোবাইল নম্বর দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট রয়েছে।" };
  }

  const passwordHash = await hashPassword(password);

  let created: { id: number };
  try {
    [created] = await db
      .insert(users)
      // `role` is never taken from user input — a customer cannot self-promote.
      .values({ name, email, phone, passwordHash, role: "customer" })
      .returning({ id: users.id });
  } catch (err) {
    // Losing the race against a concurrent signup hits the unique index.
    if (isUniqueViolation(err)) {
      return { error: "এই ইমেইল বা মোবাইল নম্বর দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট রয়েছে।" };
    }
    throw err;
  }

  await createSession(created.id);
  redirect("/account");
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const ip = await clientIp();
  if (rateLimit(`login:${ip}`, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS).limited) {
    return { error: TOO_MANY_ATTEMPTS };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়।" };
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user) {
    // Spend the same time a real bcrypt compare would, so response latency
    // cannot be used to enumerate which emails have accounts.
    await burnPasswordCompare(password);
    return { error: INVALID_CREDENTIALS };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { error: INVALID_CREDENTIALS };
  }

  // Status is checked only after the password verifies — otherwise the block
  // notice itself confirms that the email/password pair is valid.
  if (user.status !== "active") {
    return { error: "আপনার অ্যাকাউন্টটি সাময়িকভাবে ব্লক করা হয়েছে। সহায়তার জন্য যোগাযোগ করুন।" };
  }

  resetRateLimit(`login:${ip}`);
  await createSession(user.id);
  redirect(safeRedirectPath(formData.get("redirectTo")));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
