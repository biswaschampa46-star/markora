"use client";

import { useState } from "react";
import { Play } from "lucide-react";

/** YouTube লিংক থেকে embed URL বানায় (watch, youtu.be, shorts, embed সব সাপোর্ট করে) */
export function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    let id: string | null = null;
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/watch")) id = parsed.searchParams.get("v");
      else if (parsed.pathname.startsWith("/shorts/")) id = parsed.pathname.split("/")[2];
      else if (parsed.pathname.startsWith("/embed/")) id = parsed.pathname.split("/")[2];
    } else if (parsed.hostname === "youtu.be") {
      id = parsed.pathname.slice(1);
    }
    if (!id) return null;
    return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
  } catch {
    return null;
  }
}

export function getYouTubeThumbnailUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    let id: string | null = null;
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/watch")) id = parsed.searchParams.get("v");
      else if (parsed.pathname.startsWith("/shorts/")) id = parsed.pathname.split("/")[2];
      else if (parsed.pathname.startsWith("/embed/")) id = parsed.pathname.split("/")[2];
    } else if (parsed.hostname === "youtu.be") {
      id = parsed.pathname.slice(1);
    }
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  } catch {
    return null;
  }
}

export function ProductVideo({ videoUrl, title }: { videoUrl: string; title?: string }) {
  const [playing, setPlaying] = useState(false);

  const embedUrl = getYouTubeEmbedUrl(videoUrl);
  const thumbUrl = getYouTubeThumbnailUrl(videoUrl);
  if (!embedUrl) return null;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
      {playing ? (
        <iframe
          src={embedUrl}
          title={title ? `${title} - ভিডিও` : "পণ্যের ভিডিও"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="h-full w-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group relative block h-full w-full cursor-pointer"
          aria-label="ভিডিও চালান"
        >
          {thumbUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl}
              alt="ভিডিও থাম্বনেইল"
              className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
            />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/40">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 shadow-lg transition-transform group-hover:scale-110">
              <Play className="ml-1 h-8 w-8 fill-white text-white" />
            </span>
          </span>
          <span className="absolute bottom-3 left-3 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white">
            ▶ ভিডিও দেখুন
          </span>
        </button>
      )}
    </div>
  );
}
