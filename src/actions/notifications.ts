"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getCurrentUser, requireAdmin } from "@/lib/auth";

/**
 * Marks notifications as read. Admin scope marks every admin-broadcast row;
 * customer scope marks only the logged-in buyer's own rows.
 */
export async function markAllNotificationsReadAction(formData: FormData): Promise<void> {
  const scope = String(formData.get("scope") || "customer");

  if (scope === "admin") {
    const admin = await requireAdmin();
    if (!admin) return;
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.audience, "admin"), eq(notifications.isRead, false)));
    revalidatePath("/admin");
    return;
  }

  const user = await getCurrentUser();
  if (!user) return;
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.audience, "customer"),
        or(eq(notifications.userId, user.id), isNull(notifications.userId)),
        eq(notifications.isRead, false),
      ),
    );
}