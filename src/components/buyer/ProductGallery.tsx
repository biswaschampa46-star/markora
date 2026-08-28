"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";

export function ProductGallery({
  images,
  name,
}: {
  images: { url: string; alt?: string }[];
  name: string;
}) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-slate-100 text-slate-300">
        <ImageOff className="h-12 w-12" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-100">
        <Image
          src={images[active].url}
          alt={images[active].alt || name}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img.url + i}
              onClick={() => setActive(i)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${
                i === active ? "border-teal-600" : "border-transparent"
              }`}
              aria-label={`ছবি ${i + 1}`}
            >
              <Image src={img.url} alt={img.alt || name} fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
