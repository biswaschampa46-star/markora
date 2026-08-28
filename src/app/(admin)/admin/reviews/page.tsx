import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products, reviews, users } from "@/db/schema";
import { approveReviewFormAction, hideReviewFormAction } from "@/actions/admin";
import { Badge } from "@/components/ui/Badge";
import { RatingStars } from "@/components/ui/RatingStars";
import { EmptyState } from "@/components/ui/EmptyState";
import { REVIEW_STATUS_LABELS, statusBadgeTone } from "@/lib/status";
import { formatBanglaDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = status === "pending" || status === "approved" || status === "hidden" ? status : null;

  const rows = await db
    .select({ review: reviews, product: products, user: users })
    .from(reviews)
    .innerJoin(products, eq(reviews.productId, products.id))
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(filter ? eq(reviews.status, filter) : undefined)
    .orderBy(desc(reviews.createdAt));

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">পর্যালোচনা পরিচালনা</h1>

      <div className="mt-3 flex gap-2">
        {[
          [null, "সব"],
          ["pending", "পর্যালোচনাধীন"],
          ["approved", "প্রকাশিত"],
          ["hidden", "লুকানো"],
        ].map(([s, label]) => (
          <Link
            key={label as string}
            href={s ? `/admin/reviews?status=${s}` : "/admin/reviews"}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              filter === s ? "bg-teal-700 text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="কোনো পর্যালোচনা নেই।" />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {rows.map(({ review, product, user }) => (
            <article key={review.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <RatingStars rating={review.rating} />
                  <p className="mt-1 text-xs text-slate-500">
                    {user.name} · {formatBanglaDate(review.createdAt)}
                    {review.isVerifiedPurchase && (
                      <span className="ml-2 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700">
                        ভেরিফাইড ক্রয়
                      </span>
                    )}
                  </p>
                </div>
                <Badge tone={statusBadgeTone(review.status)}>
                  {REVIEW_STATUS_LABELS[review.status] ?? review.status}
                </Badge>
              </div>
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
              {review.moderationReason && (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <span className="font-medium">
                    {review.moderationSource === "wordlist"
                      ? "স্থানীয় ফিল্টার"
                      : review.moderationSource === "unavailable"
                        ? "যাচাই হয়নি"
                        : "AI যাচাই"}
                    :
                  </span>{" "}
                  {review.moderationReason}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <Link href={`/products/${product.slug}`} className="text-xs font-medium text-teal-700 hover:underline">
                  {product.name} ↗
                </Link>
                <div className="flex gap-2">
                  {review.status !== "approved" && (
                    <form action={approveReviewFormAction}>
                      <input type="hidden" name="reviewId" value={review.id} />
                      <button
                        type="submit"
                        className="h-8 rounded-lg bg-teal-700 px-3 text-xs font-medium text-white hover:bg-teal-800"
                      >
                        অনুমোদন করুন
                      </button>
                    </form>
                  )}
                  {review.status !== "hidden" && (
                    <form action={hideReviewFormAction}>
                      <input type="hidden" name="reviewId" value={review.id} />
                      <button
                        type="submit"
                        className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        লুকিয়ে রাখুন
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
