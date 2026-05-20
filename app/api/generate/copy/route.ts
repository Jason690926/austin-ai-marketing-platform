import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGeminiClient, COPY_MODEL } from '@/lib/gemini/client'
import { buildCopywriterSystemPrompt, buildCopyBrief } from '@/lib/prompts/copywriter'
import type { GenerateCopyRequest, AssetStore, AssetPurpose } from '@/types'

const STORES: AssetStore[] = ['mattress', 'bedding']
const PURPOSES: AssetPurpose[] = [
  'ad', 'google_search_ad', 'pmax_ad',
  'post', 'fb_post',
  'web_brand', 'web_product', 'seo_article',
]

export async function POST(request: Request) {
  // 1. Auth
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }

  // 2. Parse + validate
  let body: GenerateCopyRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '請求格式錯誤' }, { status: 400 })
  }
  if (!STORES.includes(body.store) || !PURPOSES.includes(body.purpose)) {
    return NextResponse.json({ error: 'store 或 purpose 不合法' }, { status: 400 })
  }

  // 3. Generate copy with Gemini 2.5 Flash
  let copyText: string
  try {
    const model = getGeminiClient().getGenerativeModel({
      model: COPY_MODEL,
      systemInstruction: buildCopywriterSystemPrompt(body.store),
    })

    const parts: any[] = [{ text: buildCopyBrief(body) }]

    if (body.referenceImageBase64) {
      const raw = body.referenceImageBase64.replace(/^data:[^;]+;base64,/, '')
      const mime =
        body.referenceImageMimeType ||
        body.referenceImageBase64.match(/^data:([^;]+);base64,/)?.[1] ||
        'image/jpeg'
      parts.push({ inlineData: { data: raw, mimeType: mime } })
      parts.push({ text: '請參考這張圖片的氛圍、光線與色調，讓文案與其情境相呼應。' })
    }

    const result = await model.generateContent(parts)
    copyText = result.response.text().trim()
    if (!copyText) {
      return NextResponse.json({ error: 'Gemini 未產生內容，請重試' }, { status: 502 })
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: `Gemini 產生失敗：${e?.message || '未知錯誤'}` },
      { status: 502 }
    )
  }

  // 4. Save to Supabase
  const { data: asset, error: dbError } = await supabase
    .from('assets')
    .insert({
      user_id: user.id,
      type: 'copy',
      store: body.store,
      purpose: body.purpose,
      copy_text: copyText,
      source: 'ai_generated',
      tags: [],
    })
    .select()
    .single()

  if (dbError) {
    return NextResponse.json(
      { error: `已產生但儲存失敗：${dbError.message}`, copy_text: copyText },
      { status: 500 }
    )
  }

  return NextResponse.json({ asset })
}
