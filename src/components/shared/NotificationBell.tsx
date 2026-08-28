import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { getAdminNotifications, getBuyerNotifications } from "@/lib/queries/notifications";
import { NotificationBellClient } from "./NotificationBellClient";

/**
 * Server wrapper: resolves the current viewer (admin panel → admin feed,
 * store → buyer feed) and renders the interactive bell with fresh data.
 * Renders nothing for guests.
 */
export async function NotificationBell({ scope }: { scope: "admin" | "customer" }) {
  if (scope === "admin") {
    const admin = await requireAdmin();
    if (!admin) return null;
    const { items, unreadCount } = await getAdminNotifications();
    return <NotificationBellClient items={items} unreadCount={unreadCount} scope="admin" align="left" />;
  }

  const user = await getCurrentUser();
  if (!user) return null;
  const { items, unreadCount } = await getBuyerNotifications(user.id);
  return <NotificationBellClient items={items} unreadCount={unreadCount} scope="customer" />;
}