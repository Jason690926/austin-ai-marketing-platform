-- ============================================================
-- Austin AI Marketing Platform — 一次性建置 SQL（合併 001 ~ 008）
-- 用途：在新的 Supabase project 的 SQL Editor 一次貼上、Run 即可
-- 等同依序執行 migrations/ 下全部檔案（001 初始 schema、002 對齊規格、
-- 003 素材刪除政策、004 廣告 purpose、005 posts 表、006 storage bucket、
-- 007 users.role 權限欄位、008 收緊 facebook_pages/scheduled_posts RLS）
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
-- （002 原本 DROP 了 users.role，007 又補回 — 合併版直接保留 001 的 role 欄位）

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
-- (008)不建任何政策:表存 Page access_token,只允許 service_role(繞過 RLS)後端存取

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
-- (008)不建任何政策:#5 排程功能動工時再按實際需求開放

DROP INDEX IF EXISTS idx_assets_status;
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);

-- ===== 003: 素材刪除政策 =====

CREATE POLICY "Users can delete own assets"
  ON assets FOR DELETE USING (auth.uid() = user_id);

-- ===== 005: 自動發文紀錄表 posts =====
-- asset_id 用 ON DELETE SET NULL 並另存 copy_text 快照，
-- 使對應素材被刪除後，發文紀錄仍完整保留。

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  copy_text TEXT NOT NULL,
  page_id TEXT NOT NULL,
  page_name TEXT NOT NULL,
  meta_post_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts(published_at DESC);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own posts"
  ON posts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own posts"
  ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ===== 006: Storage bucket（AI 產圖）=====
-- 公開讀（要顯示在 UI / 給 Meta API 抓 image_url）；
-- 寫入限登入使用者，且只能寫自己 user_id 開頭的路徑。

INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-images', 'generated-images', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

DROP POLICY IF EXISTS "Public read generated-images" ON storage.objects;
CREATE POLICY "Public read generated-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'generated-images');

DROP POLICY IF EXISTS "Auth users upload to own folder" ON storage.objects;
CREATE POLICY "Auth users upload to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'generated-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Auth users delete own files" ON storage.objects;
CREATE POLICY "Auth users delete own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'generated-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ===== 007: users.role 權限欄位（冪等保險）=====
-- 001 已含 role；此段為對「照舊版 setup.sql 建過、缺 role」的環境補洞。

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'editor';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_role_check' AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('admin', 'editor'));
  END IF;
END $$;
