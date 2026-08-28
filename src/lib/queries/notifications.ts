import "server-only";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";

/**
 * Notification feed for the bell icon. Admins receive audience="admin"
 * rows (new orders etc.); buyers receive rows targeted at their user id.
 * Unread rows drive the badge count.
 */

export type NotificationItem = {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

const FEED_LIMIT = 15;

function toItems(rows: (typeof notifications.$inferSelect)[]): NotificationItem[] {
  return rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function getAdminNotifications(): Promise<{
  items: NotificationItem[];
  unreadCount: number;
}> {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.audience, "admin"))
    .orderBy(desc(notifications.createdAt))
    .limit(FEED_LIMIT);

  const unread = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.audience, "admin"), eq(notifications.isRead, false)));

  return { items: toItems(rows), unreadCount: unread[0]?.count ?? 0 };
}

export async function getBuyerNotifications(userId: number): Promise<{
  items: NotificationItem[];
  unreadCount: number;
}> {
  // Rows addressed to this user OR broadcast customer rows without a user.
  const where = and(
    eq(notifications.audience, "customer"),
    or(eq(notifications.userId, userId), isNull(notifications.userId)),
  );

  const rows = await db
    .select()
    .from(notifications)
    .where(where)
    .orderBy(desc(notifications.createdAt))
    .limit(FEED_LIMIT);

  const unread = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(where, eq(notifications.isRead, false)));

  return { items: toItems(rows), unreadCount: unread[0]?.count ?? 0 };
}