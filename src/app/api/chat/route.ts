import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { AI_CONFIG, isAiConfigured } from "@/lib/ai/config";
import type { ChatMessage, StreamEvent, ToolCallRequest } from "@/lib/ai/config";
import { streamChatCompletion } from "@/lib/ai/openrouter";
import { buildKnowledgeBlock, buildSystemPrompt } from "@/lib/ai/knowledge";
import { executeAiTool, AI_TOOLS } from "@/lib/ai/tools";
import { getClientIp, isRateLimited } from "@/lib/ai/rate-limit";

export const runtime = "nodejs"; // pg/Drizzle — never edge
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MESSAGE_CHARS = 2000;
const MAX_BODY_BYTES = 32_000;
const MAX_HISTORY = 8;
const MAX_HISTORY_ITEM_CHARS = 1000;
const MAX_TOOL_RESULT_CHARS = 6000;
const PRODUCT_CARDS_LIMIT = 4;

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

function sanitizeHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        !!m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
    .map((m) => ({ role: m.role, content: String(m.content).trim().slice(0, MAX_HISTORY_ITEM_CHARS) }))
    .filter((m) => m.content.length > 0)
    .slice(-MAX_HISTORY);
}

export async function POST(request: NextRequest) {
  // --- gatekeepers: plain JSON errors before any stream starts ---
  if (isRateLimited(getClientIp(request))) {
    return jsonError(429, "অনেক বেশি অনুরোধ। একটু পরে চেষ্টা করুন।");
  }

  if (!isAiConfigured()) {
    console.error("[api/chat] OPENROUTER_API_KEY is not configured");
    return jsonError(503, "AI সহকারী সাময়িকভাবে অপ্রাপ্য।");
  }

  // `Content-Length` is client-supplied and can simply be omitted, so the cap
  // is enforced against the bytes actually read rather than the claim.
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return jsonError(400, "Could not read request body");
  }
  if (raw.length > MAX_BODY_BYTES) {
    return jsonError(413, "অনুরোধটি খুব বড়।");
  }

  let body: { message?: unknown; history?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonError(400, "Invalid JSON body");
  }
  if (typeof body !== "object" || body === null) {
    return jsonError(400, "Invalid JSON body");
  }

  if (typeof body.message !== "string") {
    return jsonError(400, "'message' is required");
  }
  const message = body.message.trim();
  if (message.length === 0 || message.length > MAX_MESSAGE_CHARS) {
    return jsonError(400, `'message' must be 1-${MAX_MESSAGE_CHARS} characters`);
  }

  const history = sanitizeHistory(body.history);

  // Optional identity from the app session cookie (guests are fine).
  const user = await requireCustomer();

  // Full automatic website knowledge, rebuilt fresh on every request.
  const knowledge = await buildKnowledgeBlock();
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(knowledge) },
    ...history,
    { role: "user", content: message },
  ];

  // --- streaming phase: committed to 200 + SSE from here ---
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (evt: StreamEvent) => {
        if (closed || request.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
        } catch {
          closed = true; // client vanished mid-stream
        }
      };

      send({ type: "meta", model: AI_CONFIG.model });

      try {
        for (let round = 0; round < AI_CONFIG.maxToolRounds; round++) {
          const outcome = await streamChatCompletion({
            messages,
            tools: [...AI_TOOLS],
            signal: request.signal,
            onContentDelta: (text) => send({ type: "delta", text }),
          });

          if (outcome.kind === "rate_limited") {
            console.error("[api/chat] rate limited by OpenRouter");
            send({ type: "error", message: "AI সহকারীর দৈনিক ব্যবহার সীমা শেষ হয়ে গেছে। পরে আবার চেষ্টা করুন অথবা ক্রেডিট যোগ করুন।" });
            break;
          }

          if (outcome.kind === "failed") {
            console.error("[api/chat] all model attempts exhausted:", outcome.error);
            send({ type: "error", message: "AI সহকারী সাময়িকভাবে অপ্রাপ্য। পরে আবার চেষ্টা করুন।" });
            break;
          }

          if (outcome.kind === "empty") {
            if (round === 0) send({ type: "error", message: "উত্তর পাওয়া যায়নি, আবার চেষ্টা করুন।" });
            break;
          }

          if (outcome.kind === "message") break; // final answer already streamed via deltas

          // --- tool_calls round ---
          const wireCalls: ToolCallRequest[] = outcome.calls.map((c) => ({
            id: c.id,
            type: "function",
            function: { name: c.name, arguments: c.argsRaw },
          }));
          messages.push({ role: "assistant", content: "", tool_calls: wireCalls });

          const cards = [];
          for (const call of outcome.calls) {
            const result = await executeAiTool(call.name, call.argsRaw, user);
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify(result).slice(0, MAX_TOOL_RESULT_CHARS),
            });
            if (result.ok && "products" in result) cards.push(...result.products.slice(0, PRODUCT_CARDS_LIMIT));
          }

          if (cards.length > 0) {
            const seen = new Set<number>();
            send({
              type: "products",
              products: cards.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true))).slice(0, PRODUCT_CARDS_LIMIT),
            });
          }
        }
      } catch (err) {
        if (!request.signal.aborted) {
          console.error("[api/chat] unexpected error:", err);
          send({ type: "error", message: "AI সহকারীর সাথে সংযোগ হচ্ছে না। পরে আবার চেষ্টা করুন।" });
        }
      } finally {
        send({ type: "done" });
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed by the runtime on client disconnect
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
