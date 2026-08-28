import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Heart, ImageOff } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getWishlistWithDetails } from "@/lib/queries/commerce";
import { EmptyState } from "@/components/ui/EmptyState";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { Badge } from "@/components/ui/Badge";
import { WishlistButton } from "@/components/buyer/WishlistButton";
import { AddToCartButton } from "@/components/buyer/AddToCartButton";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "পছন্দের তালিকা", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/wishlist");

  const items = await getWishlistWithDetails(user.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">পছন্দের তালিকা</h1>

      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Heart className="h-7 w-7" />}
            title="আপনার পছন্দের তালিকা খালি রয়েছে।"
            action={
              <Link href="/products">
                <Button size="sm">পণ্য দেখুন</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {items.map(({ product, priceInfo, stockAvailable }) => (
            <div key={product.id} className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="relative">
                <Link href={`/products/${product.slug}`} className="relative block aspect-square w-full bg-slate-100">
                  {product.thumbnail ? (
                    <Image src={product.thumbnail} alt={product.name} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                      <ImageOff className="h-8 w-8" />
                    </div>
                  )}
                </Link>
                <div className="absolute right-2 top-2">
                  <WishlistButton productId={product.id} active />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-3">
                <Link href={`/products/${product.slug}`} className="line-clamp-2 text-sm font-medium text-slate-800 hover:text-teal-700">
                  {product.name}
                </Link>
                <PriceDisplay price={priceInfo.price} originalPrice={priceInfo.originalPrice} />
                {stockAvailable <= 0 && <Badge tone="danger">স্টক শেষ</Badge>}
                <AddToCartButton productId={product.id} disabled={stockAvailable <= 0 || product.hasVariants} size="sm" fullWidth />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
