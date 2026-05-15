export interface AppUser {
  id: string
  email: string
  name: string
  created_at: string
}

export type AssetType = 'image' | 'copy'
export type AssetStore = 'mattress' | 'bedding'
export type AssetPurpose = 'ad' | 'post' | 'web_brand' | 'web_product' | 'seo_article' | 'fb_post'
export type AssetSource = 'ai_generated' | 'user_uploaded' | 'reference_remix'
export type ImageLevel = 'level1_base' | 'level2_complete'
export type AspectRatio = '1:1' | '4:5' | '9:16' | '16:9' | '1.91:1' | '21:9' | '4:3'

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

export interface GenerateCopyRequest {
  store: AssetStore
  purpose: AssetPurpose
  sceneId?: string
  freeformDescription?: string
  additionalNotes?: string
}

export interface GenerateResponse {
  asset: Asset
  error?: string
}
