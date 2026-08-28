import { ProductGridSkeleton } from "@/components/ui/Skeleton";

export default function StoreLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="h-40 animate-pulse rounded-2xl bg-slate-200 sm:h-56" />
      <div className="mt-10 h-5 w-48 animate-pulse rounded bg-slate-200" />
      <div className="mt-4">
        <ProductGridSkeleton />
      </div>
    </div>
  );
}
