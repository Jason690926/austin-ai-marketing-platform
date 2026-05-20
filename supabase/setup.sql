-- ============================================================
-- Austin AI Marketing Platform — 一次性建置 SQL（合併 001 + 002）
-- 用途：在新的 Supabase project 的 SQL Editor 一次貼上、Run 即可
-- 等同依序執行 migrations/001_initial_schema.sql 與 002_align_schema.sql
-- ============================================================

-- ===== 001: 初始 schema =====

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'editor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('image', 'copy', 'article', 'thread_post')),
  store TEXT NOT NULL DEFAULT 'mattress' CHECK (store IN ('mattress', 'bedding')),
  purpose TEXT NOT NULL CHECK (purpose IN ('ad', 'post', 'web_brand', 'web_product', 'seo_article', 'thread')),
  image_url TEXT,
  image_level TEXT CHECK (image_level IN ('level1_base', 'level2_complete')),
  aspect_ratio TEXT,
  width INT,
  height INT,
  prompt_used TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
  review_note TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  is_starred BOOLEAN NOT NULL DEFAULT FALSE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  source TEXT NOT NULL CHECK (source IN ('ai_generated', 'user_uploaded', 'reference_remix')),
  reference_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at DESC);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assets"
  ON assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own assets"
  ON assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own assets"
  ON assets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT USING (auth.uid() = id);

-- ===== 002: 對齊確認規格 =====

ALTER TABLE users DROP COLUMN IF EXISTS role;

ALTER TABLE assets DROP COLUMN IF EXISTS review_note;
ALTER TABLE assets DROP COLUMN IF EXISTS reviewed_by;
ALTER TABLE assets DROP COLUMN IF EXISTS reviewed_at;

ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_status_check;
ALTER TABLE assets ALTER COLUMN status SET DEFAULT 'ready';
ALTER TABLE assets ADD CONSTRAINT assets_status_check
  CHECK (status IN ('draft', 'ready'));
UPDATE assets SET status = 'ready' WHERE status IN ('approved', 'pending', 'rejected');

ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_purpose_check;
ALTER TABLE assets ADD CONSTRAINT assets_purpose_check
  CHECK (purpose IN (
    'ad', 'google_search_ad', 'pmax_ad',
    'post', 'fb_post',
    'web_brand', 'web_product', 'seo_article'
  ));
UPDATE assets SET purpose = 'fb_post' WHERE purpose = 'thread';

ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_type_check;
ALTER TABLE assets ADD CONSTRAINT assets_type_check
  CHECK (type IN ('image', 'copy'));

ALTER TABLE assets ADD COLUMN IF NOT EXISTS copy_text TEXT;

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

DROP INDEX IF EXISTS idx_assets_status;
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
