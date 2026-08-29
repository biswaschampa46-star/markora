import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getStoreSettings } from "@/lib/settings";
import { getCategoryTree } from "@/lib/queries/catalog";
import { getCartCount, getWishlistProductIds } from "@/lib/queries/commerce";
import { Navbar } from "@/components/buyer/Navbar";
import { BottomNav } from "@/components/buyer/BottomNav";
import { Footer } from "@/components/buyer/Footer";
import { OAuthErrorBanner } from "@/components/buyer/OAuthErrorBanner";
import { AiChatWidget } from "@/components/buyer/AiChatWidget";
import { NotificationBell } from "@/components/shared/NotificationBell";

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const [user, settings, categories] = await Promise.all([
    getCurrentUser(),
    getStoreSettings(),
    getCategoryTree(),
  ]);

  if (settings?.maintenanceMode && user?.role !== "admin") {
    redirect("/maintenance");
  }

  const [cartCount, wishlistIds] = user
    ? await Promise.all([getCartCount(user.id), getWishlistProductIds(user.id)])
    : [0, new Set()];

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8fa] pb-16 lg:pb-0">
      <Navbar
        storeName={settings?.storeName || "মার্কোরা"}
        logo={settings?.logo ?? null}
        cartCount={cartCount}
        wishlistCount={wishlistIds.size}
        isLoggedIn={Boolean(user)}
        categories={categories}
        notificationSlot={user ? <NotificationBell scope="customer" /> : undefined}
      />
      <main className="flex-1">
        <OAuthErrorBanner />
        {children}
      </main>
      <Footer settings={settings} />
      <BottomNav cartCount={cartCount} wishlistCount={wishlistIds.size} isLoggedIn={Boolean(user)} />
      <AiChatWidget />
    </div>
  );
}
