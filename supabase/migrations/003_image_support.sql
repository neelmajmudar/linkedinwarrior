-- Add image support to content items
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS image_url TEXT;
