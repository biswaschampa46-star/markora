import "server-only";
import { cache } from "react";
import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { customAlphabet } from "nanoid";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";

const SESSION_COOKIE = "bd_session";
const SESSION_TTL_DAYS = 30;

const nanoid = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  40,
);

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  avatar: string | null;
};

/** Cost factor for password hashing. 12 ~ 250ms on modern hardware. */
const BCRYPT_ROUNDS = 12;

/**
 * Hash of an unguessable value, computed once per process. Compared against
 * when a login is attempted for an unknown email so response time does not
 * reveal whether the account exists (user-enumeration oracle).
 */
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= bcrypt.hash(randomUUID(), BCRYPT_ROUNDS);
  return dummyHashPromise;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Burns the same amount of CPU as a real password check. Call this on the
 * "user not found" branch to keep login latency constant.
 */
export async function burnPasswordCompare(password: string): Promise<void> {
  await bcrypt.compare(password, await getDummyHash());
}

export async function createSession(userId: number) {
  const token = nanoid();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  let userAgent: string | null = null;
  try {
    const hdrs = await headers();
    userAgent = hdrs.get("user-agent");
  } catch {
    userAgent = null;
  }

  await db.insert(sessions).values({
    userId,
    token,
    userAgent,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
  }
  cookieStore.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      status: users.status,
      avatar: users.avatar,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (rows.length === 0) return null;
  return rows[0];
});

export async function requireCustomer(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  if (!user || user.status !== "active") return null;
  return user;
}

export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin" || user.status !== "active") return null;
  return user;
}

/** Thrown when a privileged read is attempted without an admin session. */
export class ForbiddenError extends Error {
  constructor(message = "Forbidden: admin privileges required") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Admin guard for functions that return data rather than an `ActionResult`.
 *
 * `requireAdmin()` returns null on failure, which is silently discarded by a
 * bare `await requireAdmin();` — leaving the data read unprotected. Server
 * actions are publicly reachable POST endpoints, so privileged reads must use
 * this throwing variant instead.
 */
export async function assertAdmin(): Promise<SessionUser> {
  const admin = await requireAdmin();
  if (!admin) throw new ForbiddenError();
  return admin;
}
