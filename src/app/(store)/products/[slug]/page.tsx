import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getApprovedReviews,
  getCategoryBySlug,
  getProductBySlug,
  getProductVariants,
  getRelatedProducts,
  hasUserReviewed,
} from "@/lib/queries/catalog";
import { getCurrentUser } from "@/lib/auth";
import { getWishlistProductIds } from "@/lib/queries/commerce";
import { hasUserPurchased } from "@/lib/queries/orders";
import { computePrice, availableStock } from "@/lib/pricing";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ProductGallery } from "@/components/buyer/ProductGallery";
import { VariantSelector } from "@/components/buyer/VariantSelector";
import { WishlistButton } from "@/components/buyer/WishlistButton";
import { RatingStars } from "@/components/ui/RatingStars";
import { Badge } from "@/components/ui/Badge";
import { ProductGrid } from "@/components/buyer/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReviewForm } from "@/components/buyer/ReviewForm";
import { RecordView } from "@/components/buyer/RecordView";
import { ProductVideo } from "@/components/buyer/ProductVideo";
import { formatBanglaDate, toBanglaDigits } from "@/lib/format";
import { ShieldCheck, RotateCcw, Truck } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "পণ্য পাওয়া যায়নি" };
  return {
    title: product.seoTitle || product.name,
    description: product.seoDescription || product.shortDescription || undefined,
    openGraph: {
      title: product.seoTitle || product.name,
      description: product.seoDescription || product.shortDescription || undefined,
      images: product.thumbnail ? [product.thumbnail] : undefined,
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || !product.isActive) notFound();

  const [variants, related, reviewsResult, user, category] = await Promise.all([
    getProductVariants(product.id),
    getRelatedProducts(product, 8),
    getApprovedReviews(product.id, 1, 20),
    getCurrentUser(),
    product.categoryId
      ? db.select().from(categories).where(eq(categories.id, product.categoryId)).limit(1)
      : Promise.resolve([]),
  ]);

  const wishlistIds = user ? await getWishlistProductIds(user.id) : new Set<number>();
  const alreadyReviewed = user ? await hasUserReviewed(user.id, product.id) : false;
  const hasPurchased = user ? await hasUserPurchased(user.id, product.id) : false;

  const priceInfo = computePrice(product);
  const stock = availableStock(product.stock, product.reservedStock);
  const categoryRow = category[0];

  const images = product.images.length > 0
    ? product.images
    : product.thumbnail
      ? [{ url: product.thumbnail, alt: product.name }]
      : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: images.map((i) => i.url),
    description: product.shortDescription || undefined,
    sku: product.sku,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "BDT",
      price: priceInfo.price,
      availability: stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
    aggregateRating:
      Number(product.reviewCount) > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: product.avgRating,
            reviewCount: product.reviewCount,
          }
        : undefined,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <RecordView productId={product.id} />

      <Breadcrumb
        items={[
          { label: "হোম", href: "/" },
          ...(categoryRow ? [{ label: categoryRow.name, href: `/category/${categoryRow.slug}` }] : []),
          { label: product.name },
        ]}
      />

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <ProductGallery images={images} name={product.name} />

        <div className="flex flex-col gap-4">
          <div>
            {product.brand && <p className="text-sm text-slate-500">{product.brand}</p>}
            <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{product.name}</h1>
            <div className="mt-2 flex items-center gap-3">
              {Number(product.reviewCount) > 0 ? (
                <>
                  <RatingStars rating={Number(product.avgRating)} showValue />
                  <span className="text-sm text-slate-500">({toBanglaDigits(product.reviewCount)} টি পর্যালোচনা)</span>
                </>
              ) : (
                <span className="text-sm text-slate-500">এখনও কোনো পর্যালোচনা নেই</span>
              )}
              {Number(product.soldCount) > 0 && (
                <span className="text-sm text-slate-500">{toBanglaDigits(product.soldCount)} বিক্রি হয়েছে</span>
              )}
            </div>
          </div>

          {product.shortDescription && <p className="text-sm leading-relaxed text-slate-600">{product.shortDescription}</p>}

          <VariantSelector
            productId={product.id}
            variants={variants}
            sizes={product.sizes}
            fallbackPrice={priceInfo.price}
            fallbackOriginalPrice={priceInfo.originalPrice}
            fallbackStock={stock}
          />

          <WishlistButton productId={product.id} active={wishlistIds.has(product.id)} variant="labeled" />

          <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-4 text-sm text-slate-600 sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-teal-700" /> দ্রুত ডেলিভারি
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-teal-700" /> {product.warranty || "নির্দিষ্ট ওয়ারেন্টি নেই"}
            </div>
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-teal-700" /> {product.returnEligible ? "রিটার্ন সুবিধা আছে" : "রিটার্নযোগ্য নয়"}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-y-2 text-sm text-slate-600">
            <dt className="text-slate-400">SKU</dt>
            <dd>{product.sku}</dd>
            {product.brand && (
              <>
                <dt className="text-slate-400">ব্র্যান্ড</dt>
                <dd>{product.brand}</dd>
              </>
            )}
            <dt className="text-slate-400">অবস্থা</dt>
            <dd>{product.condition === "new" ? "নতুন" : product.condition}</dd>
          </dl>
        </div>
      </div>

      {product.description && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold text-slate-900">বিস্তারিত বিবরণ</h2>
          <div className="whitespace-pre-line rounded-xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700">
            {product.description}
          </div>
        </section>
      )}

      {product.videoUrl && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold text-slate-900">পণ্যের ভিডিও</h2>
          <ProductVideo videoUrl={product.videoUrl} title={product.name} />
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-bold text-slate-900">ক্রেতাদের পর্যালোচনা</h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-4">
            {reviewsResult.items.length === 0 ? (
              <EmptyState title="এখনও কোনো পর্যালোচনা নেই।" />
            ) : (
              reviewsResult.items.map((review) => (
                <div key={review.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">
                        {review.userName || "ক্রেতা"}
                      </span>
                      <RatingStars rating={review.rating} size={14} />
                    </div>
                    <span className="text-xs text-slate-400">{formatBanglaDate(review.createdAt)}</span>
                  </div>
                  {review.isVerifiedPurchase && (
                    <span className="mt-1 inline-block">
                      <Badge tone="success">যাচাইকৃত ক্রয়</Badge>
                    </span>
                  )}
                  {review.comment && <p className="mt-2 text-sm text-slate-700">{review.comment}</p>}
                  {(() => {
                    const images = review.imageUrls ?? (review.imageUrl ? [review.imageUrl] : []);
                    if (images.length === 0) return null;
                    return (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {images.map((url) => (
                          <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="inline-block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="পর্যালোচনার ছবি" className="h-24 w-24 rounded-lg border border-slate-200 object-cover" />
                          </a>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              ))
            )}
          </div>
          <div>
            {!user ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                পর্যালোচনা লিখতে অনুগ্রহ করে <a href="/login" className="font-medium text-teal-700">লগইন করুন</a>।
              </div>
            ) : alreadyReviewed ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                আপনি ইতিমধ্যে এই পণ্যের জন্য পর্যালোচনা দিয়েছেন।
              </div>
            ) : !hasPurchased ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                পণ্যটি কেনার পর আপনি এখানে আপনার অভিজ্ঞতা লিখতে পারবেন।
              </div>
            ) : (
              <ReviewForm productId={product.id} />
            )}
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold text-slate-900">সম্পর্কিত পণ্য</h2>
          <ProductGrid products={related} wishlistIds={wishlistIds} />
        </section>
      )}
    </div>
  );
}
