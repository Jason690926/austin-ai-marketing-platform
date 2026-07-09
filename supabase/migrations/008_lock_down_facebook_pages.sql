-- Migration 008: 收緊 facebook_pages 的 RLS
-- 002 建表時給了「任何登入者可完整存取」政策 — 這張表存 Page access_token,
-- 等於任何 editor 都能用 anon key + 自己的 JWT 直讀所有 token,是提權地雷。
-- 表目前尚未被程式使用(#4 多經銷商 token 才會用),現在收緊零影響:
-- 撤掉 authenticated 政策後,RLS 預設拒絕一切,只剩 service_role(繞過 RLS)可讀寫 —
-- 正是 #4 規劃的用法(token 只在後端流動,絕不進前端)。

DROP POLICY IF EXISTS "Authenticated users can manage facebook pages" ON facebook_pages;

-- scheduled_posts 同一批建的同款全開政策,一併收緊(#5 排程功能動工時再按需求開)
DROP POLICY IF EXISTS "Authenticated users can manage scheduled posts" ON scheduled_posts;
