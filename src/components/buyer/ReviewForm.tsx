"use client";

import { useActionState } from "react";
import { ImagePlus, Star, X } from "lucide-react";
import { useState } from "react";
import { submitReviewAction, type ReviewActionState } from "@/actions/reviews";
import { Button } from "@/components/ui/Button";

export function ReviewForm({ productId }: { productId: number }) {
  const [state, formAction, isPending] = useActionState<ReviewActionState, FormData>(submitReviewAction, null);
  const [rating, setRating] = useState(5);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const MAX_IMAGES = 5;

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setImagePreviews((prev) => {
      const room = MAX_IMAGES - prev.length;
      const next = [...prev, ...files.slice(0, Math.max(0, room)).map((f) => URL.createObjectURL(f))];
      return next;
    });
    if (files.length + imagePreviews.length > MAX_IMAGES) {
      event.target.value = "";
    }
  }

  function clearImage(index: number) {
    setImagePreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
    const input = document.getElementById("review-image-input") as HTMLInputElement | null;
    if (input) input.value = "";
  }

  if (state?.success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        {state.success}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rating" value={rating} />
      <p className="text-sm font-medium text-slate-800">আপনার রেটিং দিন</p>
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <button key={i} type="button" onClick={() => setRating(i + 1)} aria-label={`${i + 1} স্টার`}>
            <Star className={`h-6 w-6 ${i < rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
          </button>
        ))}
      </div>
      <textarea
        name="comment"
        rows={3}
        placeholder="পণ্যটি সম্পর্কে আপনার অভিজ্ঞতা লিখুন (ঐচ্ছিক)"
        className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
      />
      <div>
        <label
          htmlFor="review-image-input"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <ImagePlus className="h-4 w-4" />
          {imagePreviews.length === 0 ? "পণ্যের ছবি যোগ করুন" : "আরও ছবি যোগ করুন"}
        </label>
        <input
          id="review-image-input"
          type="file"
          name="images"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          className="hidden"
          multiple
          onChange={handleImageChange}
          disabled={imagePreviews.length >= MAX_IMAGES}
        />
        {imagePreviews.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {imagePreviews.map((src, index) => (
              <div key={src} className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`প্রিভিউ ${index + 1}`} className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
                <button
                  type="button"
                  onClick={() => clearImage(index)}
                  aria-label="ছবি সরান"
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-800 p-0.5 text-white hover:bg-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-1 text-[11px] text-slate-400">
          সর্বোচ্চ {MAX_IMAGES}টি ছবি · প্রতিটি ৮MB · JPG, PNG, WebP, AVIF বা GIF
        </p>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" loading={isPending} size="sm" className="self-start">
        পর্যালোচনা জমা দিন
      </Button>
    </form>
  );
}
