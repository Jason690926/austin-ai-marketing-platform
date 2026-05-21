// Meta Graph API client — 發布圖文貼文到 Facebook Page。
// 單一 Page(總公司)階段:Page id / token 由 .env.local 提供。
// 未來多經銷商再改為從 DB(facebook_pages 表)讀取多組設定。

const GRAPH_VERSION = 'v21.0'

export interface MetaPageConfig {
  pageId: string
  pageName: string
  accessToken: string
}

/** 公開給前端的 Page 資訊(不含 access token) */
export interface MetaPagePublic {
  pageId: string
  pageName: string
}

/**
 * 讀取目前可用的 Page 清單。單一 Page 階段固定回傳 1 個。
 * 缺 env 時丟錯,由呼叫端決定如何呈現。
 */
export function getMetaPages(): MetaPageConfig[] {
  const pageId = process.env.META_PAGE_ID
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN
  const pageName = process.env.META_PAGE_NAME || '總公司粉專'
  if (!pageId || !accessToken) {
    throw new Error('META_PAGE_ID 或 META_PAGE_ACCESS_TOKEN 未設定於 .env.local')
  }
  return [{ pageId, pageName, accessToken }]
}

export interface PostImage {
  buffer: Buffer
  filename: string
  mimeType: string
}

/**
 * 發布一則「圖片 + 文字」貼文到指定 Page。
 * 用 multipart 直接把圖片 binary 傳給 Graph API /{page-id}/photos,圖片不落地。
 * 成功回傳 Meta 的 post id(形如 {pageId}_{postId})。
 */
export async function publishPhotoPost(
  page: MetaPageConfig,
  message: string,
  image: PostImage,
): Promise<string> {
  const form = new FormData()
  form.append('message', message)
  form.append('access_token', page.accessToken)
  form.append('published', 'true')
  form.append(
    'source',
    new Blob([new Uint8Array(image.buffer)], { type: image.mimeType }),
    image.filename,
  )

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${page.pageId}/photos`
  const resp = await fetch(url, { method: 'POST', body: form })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new Error(data?.error?.message || `Meta API HTTP ${resp.status}`)
  }
  // /photos 回傳 { id(照片 id), post_id(貼文 id) }
  return data.post_id || data.id || ''
}
