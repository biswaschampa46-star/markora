-- Reviews: optional buyer-attached product photos (Supabase Storage public URLs).
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "image_url" text;
-- Multiple photos per review (JSON array of URLs).
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "image_urls" jsonb;
