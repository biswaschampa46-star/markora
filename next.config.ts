import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Banner/product image uploads are sent through server actions.
      // The default 1MB limit rejects larger files with an opaque
      // "unexpected response" error on the client.
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "picsum.photos" },
      // Supabase Storage
      { protocol: "https", hostname: "yluakvxqukdflvpablfs.supabase.co" },
    ],
  },
};

export default nextConfig;
