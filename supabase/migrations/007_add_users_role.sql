-- Migration 007: 補回 users.role 欄位（收編雲端手動 ALTER 進版控）
-- 001 建過 role，但 002 將其 DROP，之後權限分級功能（2026-06-26）
-- 全面依賴此欄位 — 線上 DB 當時是手動 ALTER 補回的，repo 一直缺這條。
-- 本 migration 寫成冪等：全新環境與已手動補過的線上環境重跑皆無害。

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'editor';

-- CHECK constraint 分開補（欄位已存在時 ADD COLUMN 的 inline CHECK 不會生效）
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
