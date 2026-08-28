import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "@/components/providers/ToastProvider";
// Hind Siliguri is self-hosted via @font-face in globals.css (public/fonts).
// This keeps builds offline-safe: next/font/google fails the whole build
// whenever Google Fonts is unreachable, and localFont lacks unicode-range
// support which is required to serve Bengali + Latin subsets correctly.

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined,
  title: {
    default: "বাংলা শপ",
    template: "%s | বাংলা শপ",
  },
  description: "বাংলাদেশের বিশ্বস্ত অনলাইন শপিং প্ল্যাটফর্ম।",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bn">
      <body className="antialiased" suppressHydrationWarning>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
