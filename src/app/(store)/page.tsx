import Link from "next/link";
import Image from "next/image";
import { ImageOff, Truck, ShieldCheck, Wallet, Headset } from "lucide-react";
import {
  getActiveBanners,
  getActiveCategories,
  getActiveFlashSale,
  getBestSellers,
  getDiscountedProducts,
  getFeaturedProducts,
  getNewArrivals,
} from "@/lib/queries/catalog";
import { getCurrentUser } from "@/lib/auth";
import { getRecentlyViewed, getWishlistProductIds } from "@/lib/queries/commerce";
import { getStoreSettings } from "@/lib/settings";
import { HeroSlider } from "@/components/buyer/HeroSlider";
import { ProductGrid } from "@/components/buyer/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { FlashSaleCountdown } from "@/components/buyer/FlashSaleCountdown";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { computePrice } from "@/lib/pricing";

export const dynamic = "force-dynamic";

function Section({
  title,
  subtitle,
  children,
  href,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 sm:text-xl">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="text-sm font-medium text-teal-700 hover:underline">
            সব দেখুন
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default async function HomePage() {
  const [user, settings, categories, heroBanners, promoBanners, flashSale, featured, newArrivals, bestSellers, discounted] =
    await Promise.all([
      getCurrentUser(),
      getStoreSettings(),
      getActiveCategories(),
      getActiveBanners("hero"),
      getActiveBanners("promo"),
      getActiveFlashSale(),
      getFeaturedProducts(8),
      getNewArrivals(8),
      getBestSellers(8),
      getDiscountedProducts(8),
    ]);

  const [wishlistIds, recentlyViewed] = user
    ? await Promise.all([getWishlistProductIds(user.id), getRecentlyViewed(user.id, 8)])
    : [new Set<number>(), []];

  const hasContactInfo = Boolean(settings?.phone || settings?.whatsapp);

  return (
    <div className="pb-8">
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
        {heroBanners.length > 0 ? (
          <HeroSlider
            slides={heroBanners.map((b) => ({
              id: b.id,
              title: b.title,
              subtitle: b.subtitle,
              image: b.image,
              mobileImage: b.mobileImage,
              link: b.link,
            }))}
          />
        ) : (
          <div className="flex aspect-[16/7] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-teal-700 to-teal-900 sm:aspect-[21/7]">
            <p className="px-6 text-center text-lg font-semibold text-white/90">
              {settings?.storeName ? `${settings.storeName}-এ স্বাগতম` : "আমাদের অনলাইন শপে স্বাগতম"}
            </p>
          </div>
        )}
      </div>

      {/* বিশ্বস্ততার তথ্য */}
      <div className="mx-auto mt-8 grid max-w-7xl grid-cols-2 gap-3 px-4 sm:grid-cols-4 sm:px-6">
        {[
          { icon: Truck, label: "দ্রুত ডেলিভারি" },
          { icon: ShieldCheck, label: "নিরাপদ পেমেন্ট" },
          { icon: Wallet, label: "ক্যাশ অন ডেলিভারি" },
          { icon: Headset, label: "গ্রাহক সহায়তা" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <Icon className="h-5 w-5 shrink-0 text-teal-700" />
            <span className="text-xs font-medium text-slate-700 sm:text-sm">{label}</span>
          </div>
        ))}
      </div>

      {/* ক্যাটাগরি */}
      <Section title="ক্যাটাগরি অনুযায়ী কিনুন" href="/products">
        {categories.length === 0 ? (
          <EmptyState title="এখনও কোনো ক্যাটাগরি যোগ করা হয়নি।" />
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {categories.slice(0, 16).map((cat) => (
              <Link
                key={cat.id}
                href={`/category/${cat.slug}`}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-center transition hover:border-teal-600 hover:shadow-sm"
              >
                <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-slate-100">
                  {cat.image ? (
                    <Image src={cat.image} alt={cat.name} fill sizes="56px" className="object-cover" />
                  ) : (
                    <ImageOff className="h-6 w-6 text-slate-300" />
                  )}
                </div>
                <span className="line-clamp-1 text-xs font-medium text-slate-700">{cat.name}</span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* ফ্ল্যাশ সেল */}
      {flashSale && flashSale.items.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-white sm:text-xl">{flashSale.sale.title}</h2>
              <p className="text-xs text-orange-50">সীমিত সময়ের জন্য বিশেষ ছাড়</p>
            </div>
            <FlashSaleCountdown endTime={flashSale.sale.endTime.toString()} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {flashSale.items.map(({ product, discountPrice, stockLimit, soldCount }) => {
              const remaining = Math.max(0, stockLimit - soldCount);
              const percentSold = stockLimit > 0 ? Math.min(100, Math.round((soldCount / stockLimit) * 100)) : 0;
              return (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
                >
                  <div className="relative aspect-square w-full bg-slate-100">
                    {product.thumbnail ? (
                      <Image src={product.thumbnail} alt={product.name} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300">
                        <ImageOff className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 p-3">
                    <p className="line-clamp-2 text-sm font-medium text-slate-800">{product.name}</p>
                    <PriceDisplay price={Number(discountPrice)} originalPrice={computePrice(product).price} />
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full bg-red-500" style={{ width: `${percentSold}%` }} />
                    </div>
                    <span className="text-[11px] text-slate-500">{remaining > 0 ? `${remaining} টি বাকি` : "স্টক শেষ"}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <Section title="নতুন সংযোজন" subtitle="সাম্প্রতিক যোগ হওয়া পণ্যসমূহ" href="/products?sort=newest">
        {newArrivals.length === 0 ? (
          <EmptyState title="এখনও কোনো পণ্য যোগ করা হয়নি।" />
        ) : (
          <ProductGrid products={newArrivals} wishlistIds={wishlistIds} />
        )}
      </Section>

      {featured.length > 0 && (
        <Section title="নির্বাচিত পণ্য" href="/products">
          <ProductGrid products={featured} wishlistIds={wishlistIds} />
        </Section>
      )}

      {discounted.length > 0 && (
        <Section title="বিশেষ ছাড়ে পণ্য" href="/products?discount=1">
          <ProductGrid products={discounted} wishlistIds={wishlistIds} />
        </Section>
      )}

      {bestSellers.length > 0 && (
        <Section title="সর্বাধিক বিক্রিত পণ্য" href="/products?sort=popularity">
          <ProductGrid products={bestSellers} wishlistIds={wishlistIds} />
        </Section>
      )}

      {recentlyViewed.length > 0 && (
        <Section title="আপনি সম্প্রতি দেখেছেন">
          <ProductGrid products={recentlyViewed} wishlistIds={wishlistIds} />
        </Section>
      )}

      {promoBanners.length > 0 && (
        <section className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-8 sm:grid-cols-2 sm:px-6">
          {promoBanners.map((b) => {
            const content = (
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-slate-100">
                <Image src={b.image} alt={b.title ?? "প্রচারণা"} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
              </div>
            );
            return b.link ? (
              <Link key={b.id} href={b.link}>
                {content}
              </Link>
            ) : (
              <div key={b.id}>{content}</div>
            );
          })}
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center sm:p-10">
          <h2 className="text-lg font-bold text-slate-900">নতুন অফার সম্পর্কে জানতে যোগাযোগ রাখুন</h2>
          {hasContactInfo ? (
            <p className="mt-2 text-sm text-slate-600">
              {settings?.phone && <>ফোনঃ {settings.phone} </>}
              {settings?.whatsapp && <>| হোয়াটসঅ্যাপঃ {settings.whatsapp}</>}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">যোগাযোগের তথ্য এখনও সেট করা হয়নি।</p>
          )}
        </div>
      </section>
    </div>
  );
}
