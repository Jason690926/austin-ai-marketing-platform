-- Migration 002: Align schema with confirmed platform spec
-- Changes:
-- 1. Remove role from users
-- 2. Drop review columns from assets, simplify status, fix purpose/type enums
-- 3. Add copy_text column to assets
-- 4. Add facebook_pages table
-- 5. Add scheduled_posts table

-- 1. Remove role column from users
ALTER TABLE users DROP COLUMN IF EXISTS role;

-- 2. Drop review columns from assets
ALTER TABLE assets DROP COLUMN IF EXISTS review_note;
ALTER TABLE assets DROP COLUMN IF EXISTS reviewed_by;
ALTER TABLE assets DROP COLUMN IF EXISTS reviewed_at;

-- 3. Simplify assets.status → just 'draft' | 'ready'
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_status_check;
ALTER TABLE assets ALTER COLUMN status SET DEFAULT 'ready';
ALTER TABLE assets ADD CONSTRAINT assets_status_check
  CHECK (status IN ('draft', 'ready'));

-- Update existing rows
UPDATE assets SET status = 'ready' WHERE status IN ('approved', 'pending', 'rejected');

-- 4. Fix purpose enum: remove 'thread', add 'fb_post'
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_purpose_check;
ALTER TABLE assets ADD CONSTRAINT assets_purpose_check
  CHECK (purpose IN ('ad', 'post', 'web_brand', 'web_product', 'seo_article', 'fb_post'));

UPDATE assets SET purpose = 'fb_post' WHERE purpose = 'thread';

-- 5. Fix type enum: remove 'article', 'thread_post'
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_type_check;
ALTER TABLE assets ADD CONSTRAINT assets_type_check
  CHECK (type IN ('image', 'copy'));

-- 6. Add copy_text column
ALTER TABLE assets ADD COLUMN IF NOT EXISTS copy_text TEXT;

-- 7. Add facebook_pages table
CREATE TABLE IF NOT EXISTS facebook_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  access_token TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE facebook_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage facebook pages"
  ON facebook_pages FOR ALL USING (auth.role() = 'authenticated');

-- 8. Add scheduled_posts table
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  page_ids TEXT[] NOT NULL DEFAULT '{}',
  scheduled_time TIMESTAMPTZ NOT NULL,
  meta_post_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_asset_id ON scheduled_posts(asset_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_time ON scheduled_posts(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status);

ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage scheduled posts"
  ON scheduled_posts FOR ALL USING (auth.role() = 'authenticated');

-- 9. Drop old unused index
DROP INDEX IF EXISTS idx_assets_status;
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
