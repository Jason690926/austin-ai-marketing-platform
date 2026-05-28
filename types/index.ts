export interface AppUser {
  id: string
  email: string
  name: string
  created_at: string
}

export type AssetType = 'image' | 'copy'
export type AssetStore = 'mattress' | 'bedding'
export type AssetPurpose =
  | 'ad'                // Meta（FB / IG）付費廣告
  | 'google_search_ad'  // Google 搜尋廣告（Responsive Search Ads）
  | 'pmax_ad'           // Google Performance Max / Responsive Display
  | 'post'              // IG / FB 一般社群貼文
  | 'fb_post'           // FB 粉專貼文
  | 'web_brand'         // 官網品牌故事
  | 'web_product'       // 官網商品介紹
  | 'seo_article'       // SEO / AEO / GEO 內容
export type AssetSource = 'ai_generated' | 'user_uploaded' | 'reference_remix'
export type ImageLevel = 'level1_base' | 'level2_complete'
// Gemini 2.5 Flash Image 支援的比例 enum(去除 1.91:1 — Gemini 不支援)
export type AspectRatio = '1:1' | '21:9' | '16:9' | '3:2' | '4:3' | '5:4' | '4:5' | '3:4' | '2:3' | '9:16'

export interface Asset {
  id: string
  user_id: string
  type: AssetType
  store: AssetStore
  purpose: AssetPurpose
  // copy fields
  copy_text: string | null
  // image fields
  image_url: string | null
  image_level: ImageLevel | null
  aspect_ratio: string | null
  width: number | null
  height: number | null
  prompt_used: string | null
  // meta
  is_starred: boolean
  tags: string[]
  source: AssetSource
  reference_image_url: string | null
  created_at: string
}

export interface FacebookPage {
  id: string
  page_id: string
  name: string
  access_token: string
  is_active: boolean
  connected_at: string
}

export type PostStatus = 'pending' | 'published' | 'failed'

export interface ScheduledPost {
  id: string
  asset_id: string
  page_ids: string[]
  scheduled_time: string
  meta_post_id: string | null
  status: PostStatus
  error_message: string | null
  created_at: string
}

// 自動發文(migration 005 posts 表)— 每發一個 Page 一列
export type PublishStatus = 'success' | 'failed'

export interface Post {
  id: string
  user_id: string
  asset_id: string | null
  copy_text: string
  page_id: string
  page_name: string
  meta_post_id: string | null
  status: PublishStatus
  error_message: string | null
  published_at: string
}

// /publish 發布 API 回傳的逐 Page 結果
export interface PublishPageResult {
  page_id: string
  page_name: string
  status: PublishStatus
  meta_post_id: string | null
  error: string | null
  attempts: number
}

export type InputMode = 'scene' | 'reference' | 'freeform'
export type StylePreset = 'hotel_dark' | 'cozy_warm' | 'minimal_clean' | 'outdoor_natural' | 'auto'
export type SizePreset = '1080x1080' | '1080x1350' | '1080x1920' | '1200x675' | '1200x628' | '1920x800'

export interface SceneTemplate {
  id: string
  name: string
  description: string
  promptBody: string
}

export interface GenerateImageRequest {
  mode: InputMode
  store: AssetStore
  sceneId?: string
  referenceImageBase64?: string
  freeformDescription?: string
  stylePreset: StylePreset
  sizePreset: SizePreset
  additionalNotes?: string
}

export type CtaType = 'ecommerce' | 'call' | 'visit' | 'info'

export interface GenerateCopyRequest {
  store: AssetStore
  purpose: AssetPurpose
  sceneId?: string
  freeformDescription?: string
  additionalNotes?: string
  keywords?: string         // 主關鍵字（廣告 / SEO 用，可逗號分隔）
  campaigns?: string[]      // 行銷檔期 id 多選（lib/copy/campaigns.ts）
  ctaType?: CtaType         // 廣告類 CTA 類型偏好（影響 CTA 區塊用字）
  // Optional reference image (data URL or raw base64) for multimodal mood analysis
  referenceImageBase64?: string
  referenceImageMimeType?: string
}

export interface GenerateResponse {
  asset: Asset
  error?: string
}
