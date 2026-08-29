import "server-only";
import nodemailer from "nodemailer";
import { generateOrderEmailGreeting } from "@/lib/ai/email-writer";

/**
 * Automatic order-confirmation email (AI automation).
 * Sends via SMTP using env config. Absolutely never throws — an email
 * failure must never break order placement; failures are logged only.
 */

export type EmailOrderItem = {
  productName: string;
  variantName: string | null;
  quantity: number;
  total: string;
};

export type EmailOrderPayload = {
  orderNumber: string;
  buyerName: string;
  buyerEmail: string;
  recipientName: string;
  phone: string;
  addressLine: string;
  upazila: string | null;
  district: string;
  division: string;
  paymentMethod: string;
  transactionId: string | null;
  subtotal: string;
  discount: string;
  shippingFee: string;
  total: string;
  storeName: string;
  items: EmailOrderItem[];
};

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function fromAddress(): string {
  const raw = process.env.MAIL_FROM;
  if (raw && raw.trim()) return raw.trim().replace(/^"|"$/g, "");
  return `Markora <${process.env.SMTP_USER ?? "no-reply@markora.com"}>`;
}

function bn(n: number | string): string {
  return `৳${Number(n).toLocaleString("bn-BD")}`;
}

function buildHtml(p: EmailOrderPayload, greeting: string): string {
  const address = [p.addressLine, p.upazila, p.district, p.division].filter(Boolean).join(", ");
  const rows = p.items
    .map(
      (i) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;">${i.productName}${i.variantName ? ` <span style="color:#888">(${i.variantName})</span>` : ""} <span style="color:#888">× ${i.quantity}</span></td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">${bn(i.total)}</td>
      </tr>`,
    )
    .join("");
  return `<!doctype html>
<html lang="bn"><body style="margin:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <div style="background:#0f766e;color:#fff;border-radius:12px 12px 0 0;padding:20px 24px;">
      <h1 style="margin:0;font-size:20px;">${p.storeName}</h1>
    </div>
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
      <p style="margin:0 0 12px;font-size:15px;">${greeting}</p>
      <p style="margin:0 0 16px;font-size:14px;">আপনার অর্ডার সফলভাবে গ্রহণ করা হয়েছে। নিচে অর্ডারের বিবরণ দেওয়া হলো।</p>
      <p style="margin:0 0 16px;font-size:15px;">অর্ডার নং: <strong>${p.orderNumber}</strong></p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;">
        <tr><td style="padding:3px 0;color:#475569;">সাবটোটাল</td><td style="padding:3px 0;text-align:right;">${bn(p.subtotal)}</td></tr>
        ${Number(p.discount) > 0 ? `<tr><td style="padding:3px 0;color:#047857;">ছাড়</td><td style="padding:3px 0;text-align:right;color:#047857;">- ${bn(p.discount)}</td></tr>` : ""}
        <tr><td style="padding:3px 0;color:#475569;">ডেলিভারি চার্জ</td><td style="padding:3px 0;text-align:right;">${bn(p.shippingFee)}</td></tr>
        <tr><td style="padding:8px 0;font-weight:bold;border-top:2px solid #0f766e;">সর্বমোট</td><td style="padding:8px 0;text-align:right;font-weight:bold;border-top:2px solid #0f766e;">${bn(p.total)}</td></tr>
      </table>
      <div style="margin-top:16px;padding:12px;background:#f8fafc;border-radius:8px;font-size:13px;color:#475569;">
        <p style="margin:0 0 4px;"><strong>পেমেন্ট:</strong> ${p.paymentMethod}${p.transactionId ? ` (TxnID: ${p.transactionId})` : ""}</p>
        <p style="margin:0;"><strong>ডেলিভারি:</strong> ${p.recipientName}, ${p.phone}<br/>${address}</p>
      </div>
      <p style="margin:16px 0 0;font-size:13px;color:#64748b;">
        কোনো প্রশ্ন থাকলে আপনার অ্যাকাউন্টের <strong>“অর্ডার সংক্রান্ত বার্তা”</strong> বিভাগে আমাদের বার্তা দেখুন,
        অথবা WhatsApp / Facebook-এ মেসেজ করুন। (ফোন কল গ্রহণ করা হয় না।)
      </p>
    </div>
    <p style="text-align:center;font-size:12px;color:#94a3b8;margin-top:16px;">এটি একটি স্বয়ংক্রিয় (AI) ইমেইল — ${p.storeName}</p>
  </div>
</body></html>`;
}

function buildText(p: EmailOrderPayload, greeting: string): string {
  const lines = [
    greeting,
    "",
    `অর্ডার নং: ${p.orderNumber}`,
    "",
    ...p.items.map((i) => `- ${i.productName}${i.variantName ? ` (${i.variantName})` : ""} × ${i.quantity} = ${bn(i.total)}`),
    "",
    `সাবটোটাল: ${bn(p.subtotal)}`,
    ...(Number(p.discount) > 0 ? [`ছাড়: -${bn(p.discount)}`] : []),
    `ডেলিভারি চার্জ: ${bn(p.shippingFee)}`,
    `সর্বমোট: ${bn(p.total)}`,
    "",
    `পেমেন্ট: ${p.paymentMethod}${p.transactionId ? ` (TxnID: ${p.transactionId})` : ""}`,
    `ডেলিভারি: ${p.recipientName}, ${p.phone}`,
  ];
  return lines.join("\n");
}

/**
 * One-click status email (order received / order verified) with a branded
 * HTML template. Fire-and-forget safe â€” never throws.
 */
export type OrderStatusEmailPayload = {
  to: string;
  recipientName: string;
  orderNumber: string;
  orderDate: string; // pre-formatted (Bangla)
  expectedDelivery: string | null; // pre-formatted (Bangla)
  storeName: string;
};

function statusEmailHtml(p: OrderStatusEmailPayload, kind: "received" | "verified"): string {
  const isVerified = kind === "verified";
  const accent = isVerified ? "#047857" : "#0f766e";
  const title = isVerified ? "✅ অর্ডার ভেরিফাই হয়েছে" : "📦 অর্ডার গ্রহণ করা হয়েছে";
  const message = isVerified
    ? "সুখবর! আপনার অর্ডারটি ভেরিফাই (যাচাই) করা হয়েছে এবং পেমেন্ট নিশ্চিত হয়েছে। আপনার পণ্য প্রস্তুত হচ্ছে।"
    : "আপনাকে স্বাগতম! আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে এবং শীঘ্রই পাঠিয়ে দেওয়া হবে।";
  const deliveryRow = p.expectedDelivery
    ? `<tr><td style="padding:6px 0;color:#475569;">🚚 প্রত্যাশিত ডেলিভারি</td><td style="padding:6px 0;text-align:right;font-weight:bold;color:${accent};">${p.expectedDelivery}</td></tr>`
    : "";
  const footerNote = isVerified
    ? p.expectedDelivery
      ? "নির্ধারিত তারিখে ডেলিভারি পাওয়ার জন্য অপেক্ষা করুন।"
      : "ডেলিভারির তারিখ শীঘ্রই জানানো হবে।"
    : "ডেলিভারির আগে আমাদের প্রতিনিধি ফোনে যোগাযোগ করতে পারেন।";
  return `<!doctype html>
<html lang="bn"><body style="margin:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <div style="background:${accent};color:#fff;border-radius:12px 12px 0 0;padding:20px 24px;">
      <h1 style="margin:0;font-size:20px;">${p.storeName}</h1>
      <p style="margin:4px 0 0;font-size:14px;opacity:.9;">${title}</p>
    </div>
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
      <p style="margin:0 0 12px;font-size:15px;">প্রিয় <strong>${p.recipientName}</strong>,</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">${message}</p>
      <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;font-size:14px;padding:4px 12px;" cellpadding="0">
        <tr><td style="padding:6px 0;color:#475569;padding-left:12px;">📦 অর্ডার নম্বর</td><td style="padding:6px 12px 6px 0;text-align:right;font-weight:bold;">${p.orderNumber}</td></tr>
        <tr><td style="padding:6px 0;color:#475569;padding-left:12px;">🕒 অর্ডারের তারিখ</td><td style="padding:6px 12px 6px 0;text-align:right;">${p.orderDate}</td></tr>
        ${deliveryRow}
      </table>
      <div style="margin-top:16px;padding:12px;background:#ecfdf5;border-radius:8px;font-size:13px;color:#065f46;">
        ${footerNote}
      </div>
      <p style="margin:16px 0 0;font-size:13px;color:#64748b;">
        কোনো প্রশ্ন থাকলে এই ইমেইলের উত্তর দিন অথবা WhatsApp / Facebook-এ মেসেজ করুন।
      </p>
    </div>
    <p style="text-align:center;font-size:12px;color:#94a3b8;margin-top:16px;">এই ইমেইলটি ${p.storeName} থেকে পাঠানো হয়েছে</p>
  </div>
</body></html>`;
}

function statusEmailText(p: OrderStatusEmailPayload, kind: "received" | "verified"): string {
  const isVerified = kind === "verified";
  const lines = [
    `প্রিয় ${p.recipientName},`,
    "",
    isVerified
      ? "সুখবর! আপনার অর্ডারটি ভেরিফাই (যাচাই) করা হয়েছে এবং পেমেন্ট নিশ্চিত হয়েছে। আপনার পণ্য প্রস্তুত হচ্ছে।"
      : "আপনাকে স্বাগতম! আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে এবং শীঘ্রই পাঠিয়ে দেওয়া হবে।",
    "",
    `📦 অর্ডার নম্বর : ${p.orderNumber}`,
    `🕒 অর্ডারের তারিখ : ${p.orderDate}`,
    ...(p.expectedDelivery ? [`🚚 প্রত্যাশিত ডেলিভারি : ${p.expectedDelivery}`] : []),
    "",
    isVerified
      ? p.expectedDelivery
        ? "নির্ধারিত তারিখে ডেলিভারি পাওয়ার জন্য অপেক্ষা করুন।"
        : "ডেলিভারির তারিখ শীঘ্রই জানানো হবে।"
      : "ডেলিভারির আগে আমাদের প্রতিনিধি ফোনে যোগাযোগ করতে পারেন।",
    "",
    "কোনো প্রশ্ন থাকলে এই ইমেইলের উত্তর দিন অথবা WhatsApp / Facebook-এ মেসেজ করুন।",
    "",
    `— ${p.storeName} টিম`,
  ];
  return lines.join("\n");
}

export async function sendOrderStatusEmail(
  p: OrderStatusEmailPayload,
  kind: "received" | "verified",
): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn("[email] SMTP not configured â€” skipping status email for", p.orderNumber);
    return false;
  }
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const subject =
      kind === "verified"
        ? `✅ আপনার অর্ডার ${p.orderNumber} ভেরিফাই করা হয়েছে — ${p.storeName}`
        : `📦 আপনার অর্ডার ${p.orderNumber} গ্রহণ করা হয়েছে — ${p.storeName}`;
    await transporter.sendMail({
      from: fromAddress(),
      to: p.to,
      subject,
      text: statusEmailText(p, kind),
      html: statusEmailHtml(p, kind),
    });
    console.info("[email] status email (" + kind + ") sent to", p.to, "for", p.orderNumber);
    return true;
  } catch (err) {
    console.error("[email] failed to send status email for", p.orderNumber, err);
    return false;
  }
}

/**
 * Fire-and-forget safe: returns true when the email was dispatched,
 * false when SMTP is not configured or sending failed (logged, never thrown).
 */
export async function sendOrderConfirmationEmail(p: EmailOrderPayload): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn("[email] SMTP not configured — skipping order confirmation email for", p.orderNumber);
    return false;
  }
  try {
    // AI writes the personal greeting; falls back to a template on any failure.
    const greeting = await generateOrderEmailGreeting({
      buyerName: p.buyerName,
      orderNumber: p.orderNumber,
      totalBdt: p.total,
    });
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: fromAddress(),
      to: p.buyerEmail,
      subject: `অর্ডার নিশ্চিত — ${p.orderNumber} | ${p.storeName}`,
      text: buildText(p, greeting),
      html: buildHtml(p, greeting),
    });
    console.info("[email] order confirmation sent to", p.buyerEmail, "for", p.orderNumber);
    return true;
  } catch (err) {
    console.error("[email] failed to send order confirmation for", p.orderNumber, err);
    return false;
  }
}