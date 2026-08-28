export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: "পেমেন্ট যাচাইয়ের অপেক্ষায়",
  pending: "অপেক্ষমাণ",
  confirmed: "নিশ্চিত হয়েছে",
  processing: "প্রস্তুত করা হচ্ছে",
  packed: "প্যাকেট করা হয়েছে",
  shipped: "কুরিয়ারে পাঠানো হয়েছে",
  out_for_delivery: "ডেলিভারির পথে",
  delivered: "ডেলিভারি সম্পন্ন",
  cancelled: "বাতিল",
  returned: "ফেরত দেওয়া হয়েছে",
  refund_requested: "রিফান্ডের জন্য অপেক্ষমাণ",
  refunded: "রিফান্ড সম্পন্ন",
  failed: "ব্যর্থ",
};

export const ORDER_STATUS_FLOW = [
  "pending",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
];

/** Statuses an order can move to, per current status. */
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  // Unverified buyers pay the delivery charge up front; the order only enters
  // the normal workflow once the payment record has been verified.
  pending_payment: ["confirmed", "cancelled"],
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["out_for_delivery", "failed"],
  out_for_delivery: ["delivered", "failed"],
  delivered: ["returned", "refund_requested"],
  returned: [],
  refund_requested: ["refunded"],
  refunded: [],
  cancelled: [],
  failed: [],
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  initiated: "শুরু হয়েছে",
  pending: "অপেক্ষমাণ",
  successful: "সফল হয়েছে",
  failed: "ব্যর্থ হয়েছে",
  cancelled: "বাতিল হয়েছে",
  refunded: "ফেরত দেওয়া হয়েছে",
};

/** Delivery pre-payment verification statuses (admin dashboard). */
export const DELIVERY_PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "অপেক্ষমাণ",
  verified: "ভেরিফাইড",
  failed: "ব্যর্থ",
  refunded: "রিফান্ড",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bkash: "বিকাশ",
  nagad: "নগদ",
  rocket: "রকেট",
  cod: "ক্যাশ অন ডেলিভারি",
};

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: "পর্যালোচনাধীন",
  approved: "প্রকাশিত",
  hidden: "লুকানো",
};

export function statusBadgeTone(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "delivered":
    case "successful":
    case "confirmed":
    case "approved":
      return "success";
    case "cancelled":
    case "failed":
    case "returned":
      return "danger";
    case "pending":
    case "pending_payment":
    case "refund_requested":
    case "initiated":
      return "warning";
    case "shipped":
    case "out_for_delivery":
    case "processing":
    case "packed":
      return "info";
    default:
      return "neutral";
  }
}
