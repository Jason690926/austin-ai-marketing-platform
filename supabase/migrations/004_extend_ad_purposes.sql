-- Migration 004: extend assets.purpose CHECK to include Google ad types
-- 加入 google_search_ad (Responsive Search Ads) 與 pmax_ad (Performance Max / Display)
-- 既有 ad / post / fb_post / web_brand / web_product / seo_article 保持不變

ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_purpose_check;
ALTER TABLE assets ADD CONSTRAINT assets_purpose_check
  CHECK (purpose IN (
    'ad',
    'google_search_ad',
    'pmax_ad',
    'post',
    'fb_post',
    'web_brand',
    'web_product',
    'seo_article'
  ));
