"use client";

import { useEffect } from "react";
import { recordRecentlyViewedAction } from "@/actions/wishlist";

export function RecordView({ productId }: { productId: number }) {
  useEffect(() => {
    recordRecentlyViewedAction(productId).catch(() => {});
  }, [productId]);

  return null;
}
