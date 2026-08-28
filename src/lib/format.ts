const BANGLA_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function toBanglaDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => BANGLA_DIGITS[Number(d)]);
}

/**
 * Formats a numeric amount as Bangla Taka with proper Bangla digit grouping,
 * e.g. 125000 -> "৳১,২৫,০০০"
 */
export function formatBDT(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "৳০";
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return "৳০";

  const rounded = Math.round(value);
  const isNegative = rounded < 0;
  const abs = Math.abs(rounded).toString();

  // Bangladeshi grouping: last 3 digits, then groups of 2
  let grouped: string;
  if (abs.length <= 3) {
    grouped = abs;
  } else {
    const last3 = abs.slice(-3);
    const rest = abs.slice(0, -3);
    const parts: string[] = [];
    let remaining = rest;
    while (remaining.length > 2) {
      parts.unshift(remaining.slice(-2));
      remaining = remaining.slice(0, -2);
    }
    if (remaining) parts.unshift(remaining);
    grouped = `${parts.join(",")},${last3}`;
  }

  const banglaGrouped = toBanglaDigits(grouped);
  return `${isNegative ? "-" : ""}৳${banglaGrouped}`;
}

export function formatBanglaDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const months = [
    "জানুয়ারি",
    "ফেব্রুয়ারি",
    "মার্চ",
    "এপ্রিল",
    "মে",
    "জুন",
    "জুলাই",
    "আগস্ট",
    "সেপ্টেম্বর",
    "অক্টোবর",
    "নভেম্বর",
    "ডিসেম্বর",
  ];
  const day = toBanglaDigits(d.getDate());
  const month = months[d.getMonth()];
  const year = toBanglaDigits(d.getFullYear());
  return `${day} ${month}, ${year}`;
}

export function formatBanglaDateTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const datePart = formatBanglaDate(d);
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const timePart = `${toBanglaDigits(hours)}:${toBanglaDigits(
    minutes.toString().padStart(2, "0"),
  )} ${period}`;
  return `${datePart}, ${timePart}`;
}

export function slugify(input: string): string {
  return input
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\u0980-\u09FFa-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
