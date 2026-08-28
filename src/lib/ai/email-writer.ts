import "server-only";
import { AI_CONFIG, isAiConfigured } from "./config";

/**
 * AI email writer — one small non-streaming OpenRouter call that composes a
 * warm one-two sentence Bengali greeting for the automatic order-confirmation
 * email. Any failure (no key, timeout, rate limit) falls back to a fixed
 * template so the email automation never breaks because of the AI.
 */

const AI_TIMEOUT_MS = 12_000;

function fallbackGreeting(buyerName: string, orderNumber: string): string {
  return `প্রিয় ${buyerName}, আসসালামু আলাইকুম! আপনার অর্ডার (${orderNumber}) আমরা সফলভাবে পেয়েছি। Markora-তে অর্ডার করার জন্য ধন্যবাদ — আপনার পণ্য দ্রুত পৌঁছে দেওয়ার জন্য আমরা ইতিমধ্যেই প্রস্তুতি নিচ্ছি।`;
}

export async function generateOrderEmailGreeting(params: {
  buyerName: string;
  orderNumber: string;
  totalBdt: string;
}): Promise<string> {
  if (!isAiConfigured()) return fallbackGreeting(params.buyerName, params.orderNumber);

  const prompt =
    `Write a warm, friendly 1-2 sentence greeting in Bengali (বাংলা) for an order confirmation email. ` +
    `Customer name: ${params.buyerName}. Order number: ${params.orderNumber}. Order total: ৳${params.totalBdt}. ` +
    `Store: Markora (Bangladeshi e-commerce). ` +
    `Output ONLY the greeting sentence(s), no subject, no signature, no quotation marks.`;

  const models = [AI_CONFIG.model, AI_CONFIG.fallbackModel];
  for (const model of models) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
      const res = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${AI_CONFIG.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": AI_CONFIG.siteUrl,
          "X-Title": "Markora",
        },
        body: JSON.stringify({
          model,
          max_tokens: 120,
          temperature: 0.7,
          messages: [{ role: "user", content: prompt }],
        }),
      }).finally(() => clearTimeout(timer));

      if (!res.ok) continue;
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text && text.length > 5) return text.slice(0, 500);
    } catch {
      // try next model / fallback
    }
  }
  return fallbackGreeting(params.buyerName, params.orderNumber);
}
