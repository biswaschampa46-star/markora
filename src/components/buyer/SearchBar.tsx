"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search, X, ImageOff } from "lucide-react";
import { PriceDisplay } from "@/components/ui/PriceDisplay";

type Suggestion = {
  id: number;
  name: string;
  slug: string;
  thumbnail: string | null;
  price: number;
  originalPrice: number | null;
};

export function SearchBar({ className = "" }: { className?: string }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    // Debounced: runs after typing pauses; setState only happens in the async
    // callback, never synchronously in the effect body.
    const handle = setTimeout(async () => {
      if (!query.trim()) {
        setSuggestions([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.items ?? []);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="পণ্য খুঁজুন..."
          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSuggestions([]);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-label="মুছে ফেলুন"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {open && query.trim() && (
        <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {loading ? (
            <p className="px-4 py-3 text-sm text-slate-500">খুঁজছি...</p>
          ) : suggestions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">কোনো পণ্য পাওয়া যায়নি।</p>
          ) : (
            <ul>
              {suggestions.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/products/${item.slug}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50"
                  >
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      {item.thumbnail ? (
                        <Image src={item.thumbnail} alt={item.name} fill sizes="40px" className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300">
                          <ImageOff className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-800">{item.name}</p>
                      <PriceDisplay price={item.price} originalPrice={item.originalPrice} size="sm" />
                    </div>
                  </Link>
                </li>
              ))}
              <li className="border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="block w-full px-4 py-2 text-center text-sm font-medium text-teal-700 hover:bg-slate-50"
                >
                  &quot;{query}&quot; দিয়ে সব ফলাফল দেখুন
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
