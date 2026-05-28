-- Migration 006: 建立 Storage bucket 給 AI 產圖使用
-- bucket: generated-images
-- 公開讀(因要顯示在 UI / 給 Meta API 抓 image_url)
-- 寫入限登入使用者,且只能寫自己 user_id 開頭的路徑

INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-images', 'generated-images', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

-- 讓任何人讀(public bucket 也要這條才能正常存取)
DROP POLICY IF EXISTS "Public read generated-images" ON storage.objects;
CREATE POLICY "Public read generated-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'generated-images');

-- 登入使用者可上傳,但路徑前綴必須是自己的 user_id(避免互相覆蓋)
DROP POLICY IF EXISTS "Auth users upload to own folder" ON storage.objects;
CREATE POLICY "Auth users upload to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'generated-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 使用者可刪除自己的圖(對應素材庫刪除流程)
DROP POLICY IF EXISTS "Auth users delete own files" ON storage.objects;
CREATE POLICY "Auth users delete own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'generated-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
