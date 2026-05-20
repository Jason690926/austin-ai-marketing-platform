-- Migration 003: 允許使用者刪除自己的素材
-- assets 已啟用 RLS，原本只有 select/insert/update 政策，
-- 沒有 DELETE 政策時，RLS 預設拒絕所有刪除。

CREATE POLICY "Users can delete own assets"
  ON assets FOR DELETE USING (auth.uid() = user_id);
