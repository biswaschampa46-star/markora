import "server-only";
import { AI_CONFIG } from "./config";
import type { ChatMessage } from "./config";

/**
 * OpenRouter streaming client (raw fetch — no SDK).
 * Single code path: every round is requested with stream:true. Content deltas
 * are forwarded to the caller live; tool_call deltas are accumulated silently
 * and returned once the upstream stream ends.
 *
 * Retry policy (ported from the removed Cloudflare worker): 2 attempts on the
 * primary model, then 2 attempts on the fallback model. A retry is only valid
 * before the first content delta has been forwarded to the client — after that
 * the response is committed and any failure surfaces as { kind: "failed" }.
 */

export type ResolvedToolCall = {
  id: string;
  name: string;
  argsRaw: string;
};

export type StreamOutcome =
  | { kind: "message"; content: string }
  | { kind: "tool_calls"; calls: ResolvedToolCall[] }
  | { kind: "empty" }
  | { kind: "failed"; error: string }
  | { kind: "rate_limited"; resetMs?: number };

const RETRY_DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ToolCallDelta = {
  index?: number;
  id?: string;
  function?: { name?: string; arguments?: string };
};

/**
 * Accumulates streamed tool_call deltas. Handles provider quirks:
 * - `index` may be omitted → assign sequentially.
 * - `id` normally arrives once; keep the first non-empty value.
 * - some providers split `function.name` across chunks → concat.
 */
class ToolCallAccumulator {
  private parts = new Map<number, { id: string; name: string; args: string }>();
  private nextIndex = 0;

  add(deltas: ToolCallDelta[] | undefined) {
    if (!deltas) return;
    for (const d of deltas) {
      const idx = typeof d.index === "number" ? d.index : this.nextIndex;
      const cur = this.parts.get(idx) ?? { id: "", name: "", args: "" };
      if (d.id && !cur.id) cur.id = d.id;
      if (d.function?.name) cur.name += d.function.name;
      if (d.function?.arguments) cur.args += d.function.arguments;
      this.parts.set(idx, cur);
      this.nextIndex = Math.max(this.nextIndex, idx + 1);
    }
  }

  hasCalls(): boolean {
    for (const p of this.parts.values()) if (p.name) return true;
    return false;
  }

  finalize(): ResolvedToolCall[] {
    return [...this.parts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, p]) => ({ id: p.id, name: p.name, argsRaw: p.args }))
      .filter((c) => c.name.length > 0);
  }
}

type UpstreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string | null;
      reasoning?: string | null;
      reasoning_content?: string | null;
      tool_calls?: ToolCallDelta[];
    };
    finish_reason?: string | null;
  }>;
};

async function attemptStream(params: {
  model: string;
  messages: ChatMessage[];
  tools: unknown[];
  signal?: AbortSignal;
  onContentDelta: (text: string) => void;
}): Promise<
  | { ok: true; outcome: Exclude<StreamOutcome, { kind: "failed" }> }
  // retryable = nothing was forwarded yet; fatal = client already got bytes
  | { ok: false; retryable: boolean; error: string }
> {
  let res: Response;
  try {
    res = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
      method: "POST",
      signal: params.signal,
      headers: {
        Authorization: `Bearer ${AI_CONFIG.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": AI_CONFIG.siteUrl,
        "X-Title": "Markora AI",
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        tools: params.tools,
        tool_choice: "auto",
        stream: true,
        max_tokens: AI_CONFIG.maxTokens,
        temperature: AI_CONFIG.temperature,
      }),
    });
  } catch (err) {
    if (params.signal?.aborted) throw err; // client disconnect — propagate
    return { ok: false, retryable: true, error: `fetch failed: ${String(err)}` };
  }

  if (!res.ok || !res.body) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    // 429 = rate-limited (daily quota or IP limit) — retries won't help
    const retryable = res.status !== 429;
    return {
      ok: false,
      retryable,
      error: `HTTP ${res.status}: ${detail}`,
    };
  }

  const acc = new ToolCallAccumulator();
  let content = "";
  let committed = false;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let doneReading = false;

  try {
    while (!doneReading) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);

        for (const line of frame.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue; // comment/keep-alive
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload) continue;

          if (payload === "[DONE]") {
            doneReading = true;
            break;
          }

          let chunk: UpstreamChunk;
          try {
            chunk = JSON.parse(payload) as UpstreamChunk;
          } catch {
            continue; // malformed chunk — skip silently
          }

          const choice = chunk.choices?.[0];
          if (!choice?.delta) continue;

          // Reasoning-model scratch fields are never forwarded.
          const text = choice.delta.content;
          if (typeof text === "string" && text.length > 0) {
            committed = true;
            content += text;
            params.onContentDelta(text);
          }
          if (choice.delta.tool_calls) acc.add(choice.delta.tool_calls);
        }
        if (doneReading) break;
      }
    }
  } catch (err) {
    if (params.signal?.aborted) throw err;
    return {
      ok: false,
      retryable: !committed,
      error: `stream interrupted${committed ? " after first delta" : ""}: ${String(err)}`,
    };
  } finally {
    reader.releaseLock();
  }

  if (acc.hasCalls()) return { ok: true, outcome: { kind: "tool_calls", calls: acc.finalize() } };
  if (content.trim().length > 0) return { ok: true, outcome: { kind: "message", content } };
  return { ok: true, outcome: { kind: "empty" } };
}

export async function streamChatCompletion(params: {
  messages: ChatMessage[];
  tools: unknown[];
  signal?: AbortSignal;
  onContentDelta: (text: string) => void;
}): Promise<StreamOutcome> {
  const attempts: string[] = [AI_CONFIG.model, AI_CONFIG.model, AI_CONFIG.fallbackModel, AI_CONFIG.fallbackModel];

  let lastError = "unknown error";
  let rateLimited = false;
  let resetMs: number | undefined;
  for (let i = 0; i < attempts.length; i++) {
    const result = await attemptStream({ ...params, model: attempts[i] });
    if (result.ok) return result.outcome;
    lastError = result.error;
    // Detect429 rate limit — extract reset timestamp if available
    if (!result.retryable && result.error.includes("HTTP 429")) {
      rateLimited = true;
      try {
        const match = result.error.match(/X-RateLimit-Reset["\s:]*(\d{13})/);
        if (match) resetMs = Number(match[1]) - Date.now();
      } catch { /* ignore */ }
    }
    if (!result.retryable) break;
    console.error(
      `[openrouter] attempt ${i + 1}/${attempts.length} failed (${attempts[i]}): ${result.error}`,
    );
    if (i < attempts.length - 1) await sleep(RETRY_DELAY_MS);
  }

  if (rateLimited) return { kind: "rate_limited", resetMs };
  return { kind: "failed", error: lastError };
}
