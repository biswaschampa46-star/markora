"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Loader2, Bot } from "lucide-react";

const API_URL = "/api/chat";

type ProductCard = {
  id: number;
  slug: string;
  name: string;
  thumbnail: string | null;
  price: number;
  originalPrice: number | null;
};

type StreamEvent =
  | { type: "meta"; model: string }
  | { type: "delta"; text: string }
  | { type: "products"; products: ProductCard[] }
  | { type: "done" }
  | { type: "error"; message: string };

type Msg = {
  role: "user" | "assistant";
  content: string;
  products?: ProductCard[];
};

function prettyModel(model: string): string {
  // "nvidia/nemotron-3-ultra-550b-a55b:free" -> "Nemotron 3 Ultra"
  const base = model.split("/").pop()?.split(":")[0] ?? model;
  const m = base.match(/nemotron-(\d+(?:\.\d+)?)-([a-z]+)/i);
  if (m) return `${m[1]} ${m[2]}`.replace(/(^|[-\s])(\w)/g, (s) => s.toUpperCase()).replace(/-/g, " ");
  return base;
}

export function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [modelLabel, setModelLabel] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "আসসালামু আলাইকুম! 👋\nআমি মার্কোরার AI সহকারী। পণ্য খুঁজতে, সুপারিশ পেতে বা অর্ডার সম্পর্কে জানতে আমাকে জিজ্ঞাসা করুন!" },
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Cancel any in-flight stream on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  const closePanel = useCallback(() => {
    abortRef.current?.abort();
    setOpen(false);
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const history = messages
      .filter((m) => m.content.trim())
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setLoading(true);

    // Deltas are buffered and flushed on an interval to avoid a setState per token.
    let pendingText = "";
    let flushTimer: ReturnType<typeof setInterval> | null = null;
    const flush = () => {
      if (!pendingText) return;
      const chunk = pendingText;
      pendingText = "";
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") next[next.length - 1] = { ...last, content: last.content + chunk };
        return next;
      });
    };

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        let errorMsg = "AI সহকারীর সাথে সংযোগ হচ্ছে না। পরে আবার চেষ্টা করুন।";
        try {
          const data = await res.json();
          if (data?.error) errorMsg = data.error;
        } catch {
          // keep generic message
        }
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant" && !last.content) {
            next[next.length - 1] = { ...last, content: `⚠️ ${errorMsg}` };
          }
          return next;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      flushTimer = setInterval(flush, 50);

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });

        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);

          for (const line of frame.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload) continue;

            let evt: StreamEvent;
            try {
              evt = JSON.parse(payload) as StreamEvent;
            } catch {
              continue;
            }

            if (evt.type === "meta") {
              setModelLabel(prettyModel(evt.model));
            } else if (evt.type === "delta") {
              pendingText += evt.text;
            } else if (evt.type === "products") {
              flush();
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === "assistant") {
                  next[next.length - 1] = { ...last, products: evt.products.slice(0, 4) };
                }
                return next;
              });
            } else if (evt.type === "error") {
              pendingText += (pendingText ? "\n\n" : "") + `⚠️ ${evt.message}`;
            } else if (evt.type === "done") {
              done = true;
              break;
            }
          }
          if (done) break;
        }
      }

      flush();

      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant" && !last.content.trim()) {
          next[next.length - 1] = { ...last, content: "দুঃখিত, উত্তর পাওয়া যায়নি।" };
        }
        return next;
      });
    } catch (err) {
      flush();
      if ((err as Error)?.name !== "AbortError") {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant" && !last.content.trim()) {
            next[next.length - 1] = { ...last, content: "⚠️ AI সহকারীর সাথে সংযোগ হচ্ছে না। পরে আবার চেষ্টা করুন।" };
          }
          return next;
        });
      }
    } finally {
      if (flushTimer) clearInterval(flushTimer);
      setLoading(false);
    }
  }, [input, loading, messages]);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => (open ? closePanel() : setOpen(true))}
        className={`fixed bottom-20 right-4 z-50 lg:bottom-6 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 ${
          open ? "bg-gray-700 rotate-0" : "bg-teal-600 hover:bg-teal-700 hover:scale-110"
        }`}
        aria-label="AI সহকারী"
      >
        {open ? <X className="h-6 w-6 text-white" /> : <Bot className="h-7 w-7 text-white" />}
        {!open && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-green-500" />
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-36 right-4 z-50 lg:bottom-20 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" style={{ height: "min(520px, calc(100vh - 200px))" }}>
          {/* Header */}
          <div className="flex items-center gap-3 bg-teal-600 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">মার্কোরা AI</p>
              <p className="text-xs text-teal-100">অনলাইন{modelLabel ? ` • ${modelLabel}` : ""}</p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-teal-600 text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                }`}>
                  <p className="whitespace-pre-line">{m.content}</p>

                  {/* Product cards */}
                  {m.products && m.products.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {m.products.slice(0, 4).map((p) => (
                        <a
                          key={p.id}
                          href={`/products/${p.slug}`}
                          className="flex items-center gap-3 rounded-xl bg-white p-2 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                        >
                          {p.thumbnail && (
                            <img src={p.thumbnail} alt={p.name} className="h-12 w-12 rounded-lg object-cover" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                            <p className="text-xs text-teal-600 font-bold">
                              ৳{Number(p.price).toLocaleString()}
                              {p.originalPrice != null && p.originalPrice !== p.price && (
                                <span className="ml-1 text-gray-400 line-through font-normal">৳{Number(p.originalPrice).toLocaleString()}</span>
                              )}
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-gray-100 px-4 py-2.5 rounded-bl-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                  <span className="text-xs text-gray-500">ভাবছে...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 px-3 py-2">
            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="পণ্য সম্পর্কে জিজ্ঞাসা করুন..."
                className="flex-1 rounded-full border border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-800 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-white transition hover:bg-teal-700 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
