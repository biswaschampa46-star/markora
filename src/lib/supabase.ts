import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Bucket name used for product images. */
export const PRODUCT_IMAGES_BUCKET = "product-images";

/**
 * Image types accepted for upload. An allowlist rather than a blocklist, and
 * SVG is deliberately excluded: the bucket is served from a public URL, and an
 * SVG is an executable document — uploading one would give stored XSS on the
 * storage origin.
 */
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

/** Matches the 10MB server-action body limit in next.config.ts. */
const MAX_FILE_BYTES = 8 * 1024 * 1024;

/** Raised when a file fails validation, so callers can show the reason. */
export class InvalidUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUploadError";
  }
}

/**
 * Normalizes a caller-supplied storage folder to a safe relative path.
 *
 * Folder names are built from user-controlled values (product slugs), so
 * `..`, absolute paths, and control characters must be stripped — otherwise the
 * upload can be steered outside its intended prefix within the bucket.
 */
export function sanitizeStoragePath(path: string): string {
  const cleaned = path
    .split("/")
    .map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/^\.+/, "").slice(0, 64))
    .filter((segment) => segment.length > 0 && segment !== "." && segment !== "..")
    .slice(0, 4)
    .join("/");
  return cleaned || "products";
}

/**
 * Rejects anything that is not a reasonably sized, allowlisted raster image.
 * Note that `file.type` is client-supplied metadata: it stops the accidental
 * and casual cases, but the bucket should also be configured to serve
 * `Content-Disposition: attachment` for defence in depth.
 */
function assertValidImage(file: File): void {
  if (file.size === 0) {
    throw new InvalidUploadError("ফাইলটি খালি।");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new InvalidUploadError(
      `ছবির আকার ${Math.round(MAX_FILE_BYTES / (1024 * 1024))}MB এর মধ্যে হতে হবে।`,
    );
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new InvalidUploadError("শুধুমাত্র JPG, PNG, WebP, AVIF বা GIF ছবি আপলোড করা যাবে।");
  }
}

/**
 * Lazy-initialized Supabase client.
 * Created on first use so module-level env var reads don't crash at import time.
 */
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars: SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required in .env.local",
    );
  }

  _client = createClient(url, key);
  return _client;
}

/**
 * Uploads a file to Supabase Storage and returns the public URL.
 * Files are stored under `{bucket}/{path}/{timestamp}-{safeFilename}`.
 */
export async function uploadProductImage(
  file: File,
  path: string = "products",
): Promise<{ url: string; path: string }> {
  assertValidImage(file);

  const client = getClient();
  // The stored name is generated, not echoed from the client: a random suffix
  // avoids collisions between concurrent uploads of the same filename, and the
  // extension is derived from the validated MIME type rather than the filename.
  const extension = EXTENSION_BY_MIME[file.type] ?? "bin";
  const unique = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const filePath = `${sanitizeStoragePath(path)}/${unique}.${extension}`;

  const { error } = await client.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data: urlData } = client.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .getPublicUrl(filePath);

  return { url: urlData.publicUrl, path: filePath };
}

/**
 * Deletes a file from Supabase Storage by its path or public URL.
 */
export async function deleteProductImage(urlOrPath: string): Promise<void> {
  if (!urlOrPath.trim()) return;
  const client = getClient();

  // Accept either a full Supabase public URL or a bare storage path.
  // Public URL format: https://{ref}.supabase.co/storage/v1/object/public/{bucket}/{path}
  let storagePath = urlOrPath;
  const publicMarker = `/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`;
  const markerIdx = urlOrPath.indexOf(publicMarker);
  if (markerIdx !== -1) {
    storagePath = urlOrPath.slice(markerIdx + publicMarker.length);
  }

  const { error } = await client.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .remove([storagePath]);

  if (error) {
    throw new Error(`Supabase delete failed: ${error.message}`);
  }
}

/**
 * Turns an upload failure into a message that is safe to show a user.
 * Validation problems are the user's to fix and are surfaced verbatim; anything
 * else (storage outage, bad credentials) is logged and reported generically so
 * infrastructure detail never reaches the browser.
 */
export function describeUploadError(error: unknown): string {
  if (error instanceof InvalidUploadError) return error.message;
  console.error("[storage] upload failed:", error);
  return "ছবি আপলোড করা যায়নি। একটু পরে আবার চেষ্টা করুন।";
}

/**
 * Uploads multiple files and returns their public URLs.
 */
export async function uploadProductImages(
  files: File[],
  path: string = "products",
): Promise<{ url: string; path: string }[]> {
  return Promise.all(files.map((f) => uploadProductImage(f, path)));
}
