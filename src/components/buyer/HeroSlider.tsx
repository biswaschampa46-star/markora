"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Slide = {
  id: number;
  title: string | null;
  subtitle: string | null;
  image: string;
  mobileImage: string | null;
  link: string | null;
};

export function HeroSlider({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 5500);
    return () => clearInterval(id);
  }, [slides.length]);

  if (slides.length === 0) return null;

  const slide = slides[index];
  const content = (
    <div className="relative aspect-[16/7] w-full overflow-hidden rounded-2xl bg-slate-100 sm:aspect-[21/7]">
      {/* Dedicated mobile banner when provided; desktop art otherwise. */}
      <picture className="relative block h-full">
        {slide.mobileImage && <source media="(max-width: 639px)" srcSet={slide.mobileImage} />}
        <Image
          src={slide.image}
          alt={slide.title ?? "প্রচারণা ব্যানার"}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </picture>
      {(slide.title || slide.subtitle) && (
        <div className="absolute inset-0 flex flex-col justify-center gap-2 bg-gradient-to-r from-slate-950/60 via-slate-950/10 to-transparent p-6 sm:p-10">
          {slide.title && <h2 className="max-w-md text-xl font-bold text-white sm:text-3xl">{slide.title}</h2>}
          {slide.subtitle && <p className="max-w-sm text-sm text-slate-100 sm:text-base">{slide.subtitle}</p>}
        </div>
      )}
    </div>
  );

  return (
    <div className="relative">
      {slide.link ? <Link href={slide.link}>{content}</Link> : content}
      {slides.length > 1 && (
        <>
          <button
            aria-label="পূর্ববর্তী"
            onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
            className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow hover:bg-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            aria-label="পরবর্তী"
            onClick={() => setIndex((i) => (i + 1) % slides.length)}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow hover:bg-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                aria-label={`স্লাইড ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-1.5 bg-white/60"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
