import Link from "next/link";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import type { ProductRow } from "@/lib/queries/catalog";
import { computePrice, availableStock } from "@/lib/pricing";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { RatingStars } from "@/components/ui/RatingStars";
import { Badge } from "@/components/ui/Badge";
import { WishlistButton } from "@/components/buyer/WishlistButton";
import { AddToCartButton } from "@/components/buyer/AddToCartButton";

export function ProductCard({
  product,
  wishlisted,
}: {
  product: ProductRow;
  wishlisted?: boolean;
}) {
  const priceInfo = computePrice(product);
  const stock = availableStock(product.stock, product.reservedStock);
  const outOfStock = stock <= 0;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-md">
      <Link href={`/products/${product.slug}`} className="relative block aspect-square w-full overflow-hidden bg-slate-100">
        {product.thumbnail ? (
          <Image
            src={product.thumbnail}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <ImageOff className="h-10 w-10" aria-hidden="true" />
          </div>
        )}
        {priceInfo.hasDiscount && (
          <span className="absolute left-2 top-2">
            <Badge tone="danger">{`-${priceInfo.discountPercent}%`}</Badge>
          </span>
        )}
        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Badge tone="neutral">স্টক শেষ</Badge>
          </div>
        )}
      </Link>
      <div className="absolute right-2 top-2">
        <WishlistButton productId={product.id} active={wishlisted} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {product.brand && <span className="text-xs text-slate-400">{product.brand}</span>}
        <Link href={`/products/${product.slug}`} className="line-clamp-2 text-sm font-medium text-slate-800 hover:text-teal-700">
          {product.name}
        </Link>
        {Number(product.reviewCount) > 0 ? (
          <RatingStars rating={Number(product.avgRating)} size={14} />
        ) : (
          <span className="text-xs text-slate-400">এখনও কোনো পর্যালোচনা নেই</span>
        )}
        <PriceDisplay price={priceInfo.price} originalPrice={priceInfo.originalPrice} />
        <div className="mt-1">
          {product.hasVariants ? (
            <Link
              href={`/products/${product.slug}`}
              className="flex h-9 w-full items-center justify-center rounded-lg bg-teal-700 text-sm font-medium text-white hover:bg-teal-800"
            >
              বিস্তারিত দেখুন
            </Link>
          ) : (
            <AddToCartButton productId={product.id} disabled={outOfStock} size="sm" fullWidth />
          )}
        </div>
      </div>
    </div>
  );
}

export function ProductGrid({
  products,
  wishlistIds,
}: {
  products: ProductRow[];
  wishlistIds?: Set<number>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} wishlisted={wishlistIds?.has(p.id)} />
      ))}
    </div>
  );
}
