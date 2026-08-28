import "server-only";

/**
 * Central AI configuration. OpenRouter is the only supported provider.
 * Reads .env.local; must never throw when the key is absent — the chat route
 * degrades to a 503 JSON error via isAiConfigured().
 */
export const AI_CONFIG = {
  baseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  // Upgraded stack (free tier): DeepSeek V3.1 primary, Llama 3.3 70B fallback.
  model: process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-chat-v3.1:free",
  fallbackModel:
    process.env.OPENROUTER_FALLBACK_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free",
  maxTokens: Number(process.env.AI_MAX_TOKENS) || 1200,
  temperature: Number(process.env.AI_TEMPERATURE) || 0.4,
  maxToolRounds: Number(process.env.MAX_TOOL_ROUNDS) || 6,
  rateLimitPerHour: Number(process.env.AI_RATE_LIMIT_PER_HOUR) || 20,
  knowledgeProductLimit: Number(process.env.AI_KNOWLEDGE_PRODUCT_LIMIT) || 48,
} as const;

export function isAiConfigured(): boolean {
  return Boolean(AI_CONFIG.apiKey);
}

export type ToolCallRequest = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: ToolCallRequest[] }
  | { role: "tool"; tool_call_id: string; content: string };

/** Product card sent to the widget (camelCase, price precomputed). */
export type ProductCard = {
  id: number;
  slug: string;
  name: string;
  thumbnail: string | null;
  price: number;
  originalPrice: number | null;
};

/** Server → client SSE event payloads for /api/chat. */
export type StreamEvent =
  | { type: "meta"; model: string }
  | { type: "delta"; text: string }
  | { type: "products"; products: ProductCard[] }
  | { type: "done" }
  | { type: "error"; message: string };
