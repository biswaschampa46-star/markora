import { customAlphabet } from "nanoid";

const numeric = customAlphabet("0123456789", 6);

export function generateOrderNumber(prefix = "ORD"): string {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${prefix}-${y}${m}${d}-${numeric()}`;
}
