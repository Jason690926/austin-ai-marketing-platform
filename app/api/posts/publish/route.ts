import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMetaPages, publishPhotoPost, type MetaPageConfig, type PostImage } from '@/lib/meta/client'
import type { PublishPageResult, PublishStatus } from '@/types'

export async function POST(request: Request) {
  // 1. Auth
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 })

  // 2. 解析 multipart form
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: '請求格式錯誤(需 multipart/form-data)' }, { status: 400 })
  }

  const copyText = String(form.get('copyText') ?? '').trim()
  const assetIdRaw = form.get('assetId')
  const assetId = assetIdRaw ? String(assetIdRaw) : null
  const imageFile = form.get('image')

  if (!copyText) return NextResponse.json({ error: '缺少文案內容' }, { status: 400 })
  if (!(imageFile instanceof File) || imageFile.size === 0) {
    return NextResponse.json({ error: '缺少圖片' }, { status: 400 })
  }

  let pageIds: string[]
  try {
    const raw = form.get('pageIds')
    pageIds = raw ? JSON.parse(String(raw)) : []
  } catch {
    return NextResponse.json({ error: 'pageIds 格式錯誤' }, { status: 400 })
  }
  if (!Array.isArray(pageIds) || pageIds.length === 0) {
    return NextResponse.json({ error: '請至少選擇一個粉專' }, { status: 400 })
  }

  // 3. 取得設定的 Page,過濾出使用者勾選的
  let allPages: MetaPageConfig[]
  try {
    allPages = getMetaPages()
  } catch (e: any) {
    return NextResponse.json({ error: `Meta 未設定:${e?.message || e}` }, { status: 500 })
  }
  const selectedPages = allPages.filter(p => pageIds.includes(p.pageId))
  if (selectedPages.length === 0) {
    return NextResponse.json({ error: '勾選的粉專不在系統設定中' }, { status: 400 })
  }

  // 4. 準備圖片 binary(直傳 Meta,不落地)
  const image: PostImage = {
    buffer: Buffer.from(await imageFile.arrayBuffer()),
    filename: imageFile.name || 'image.jpg',
    mimeType: imageFile.type || 'image/jpeg',
  }

  // 5. 發布 — 逐家發、成功略過失敗;全部跑完後失敗清單重試第 2 次
  const results = new Map<string, PublishPageResult>()

  async function attempt(page: MetaPageConfig, attemptNo: number) {
    try {
      const metaPostId = await publishPhotoPost(page, copyText, image)
      results.set(page.pageId, {
        page_id: page.pageId,
        page_name: page.pageName,
        status: 'success',
        meta_post_id: metaPostId,
        error: null,
        attempts: attemptNo,
      })
    } catch (e: any) {
      results.set(page.pageId, {
        page_id: page.pageId,
        page_name: page.pageName,
        status: 'failed',
        meta_post_id: null,
        error: e?.message || '未知錯誤',
        attempts: attemptNo,
      })
    }
  }

  // Round 1
  for (const page of selectedPages) {
    await attempt(page, 1)
  }
  // Round 2 — 只重試第 1 輪失敗的
  const retryPages = selectedPages.filter(p => results.get(p.pageId)?.status === 'failed')
  for (const page of retryPages) {
    await attempt(page, 2)
  }

  const ordered: PublishPageResult[] = selectedPages.map(p => results.get(p.pageId)!)

  // 6. 寫入 posts 表(每個 Page 一列)
  const { error: dbError } = await supabase.from('posts').insert(
    ordered.map(r => ({
      user_id: user.id,
      asset_id: assetId,
      copy_text: copyText,
      page_id: r.page_id,
      page_name: r.page_name,
      meta_post_id: r.meta_post_id,
      status: r.status,
      error_message: r.error,
    })),
  )

  const successCount = ordered.filter(r => r.status === 'success').length
  const failedCount = ordered.length - successCount

  return NextResponse.json({
    success: true,
    results: ordered,
    successCount,
    failedCount,
    recordWarning: dbError ? `發文已執行,但發文紀錄儲存失敗:${dbError.message}` : null,
  })
}
