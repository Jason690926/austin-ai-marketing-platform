import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGeminiClient, COPY_MODEL } from '@/lib/gemini/client'
import { buildCopywriterSystemPrompt, buildCopyBrief } from '@/lib/prompts/copywriter'
import { isStructuredPurpose } from '@/lib/copy/parse-sections'
import { STRUCTURED_SCHEMAS, serializeSections, validateQuota, clipStructured, type StructuredPurpose } from '@/lib/copy/structured-output'
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
  // 待辦 D:廣告/SEO 類用途改走 responseSchema 強制結構化 JSON(滿配由 schema 的
  // minItems/maxItems 保證),拿到 JSON 後序列化成標準格式的【區塊名】文字再存。
  // temperature 仍維持 1.2 — schema 只約束結構、不殺用字發散。
  const structured = isStructuredPurpose(body.purpose)
  let copyText: string
  try {
    const model = getGeminiClient().getGenerativeModel({
      model: COPY_MODEL,
      systemInstruction: buildCopywriterSystemPrompt(body.store),
      // 變化機制(二):拉高取樣隨機性,搭配 buildCopyBrief 注入的隨機創意方向,
      // 讓每次產出在用字與結構上都更發散,降低雷同。1.2 兼顧多樣性與中文通順度。
      generationConfig: {
        temperature: 1.2,
        topP: 0.97,
        ...(structured
          ? {
              responseMimeType: 'application/json',
              responseSchema: STRUCTURED_SCHEMAS[body.purpose as StructuredPurpose],
            }
          : {}),
      },
    })

    const parts: any[] = [{ text: buildCopyBrief(body) }]

    if (body.referenceImageBase64) {
      const raw = body.referenceImageBase64.replace(/^data:[^;]+;base64,/, '')
      const mime =
        body.referenceImageMimeType ||
        body.referenceImageBase64.match(/^data:([^;]+);base64,/)?.[1] ||
        'image/jpeg'
      parts.push({ inlineData: { data: raw, mimeType: mime } })
      parts.push({
        text: [
          '【參考圖片指令】這張圖片是本次文案的主視覺核心，請務必：',
          '1. 先辨識圖中的「主角」—— 聯名授權角色（如 SNOOPY 等）、具體商品、或人物情境。',
          '2. 將辨識到的主角寫成文案主軸：聯名角色以「角色」為主角發揮其個性與情感連結；商品則以其外觀與材質質感為描述主體。',
          '3. 圖片的氛圍、光線、色調僅作為情緒基調輔助，不可取代主角。',
          '4. 只描述圖中實際看得到的元素，不杜撰；不確定角色名稱時用一般性描述帶過，不要猜錯。',
          '5. 品牌名不要硬塞進正文：正文聚焦主角,品牌識別優先放 hashtag 或結尾署名,正文最多自然帶出一次。',
        ].join('\n'),
      })
    }

    const result = await model.generateContent(parts)
    const raw = result.response.text().trim()
    if (!raw) {
      return NextResponse.json({ error: 'Gemini 未產生內容，請重試' }, { status: 502 })
    }

    if (structured) {
      // responseSchema 下回傳的是 JSON;解析 → 後驗證(只 log 警告) → 序列化成標準【區塊名】文字。
      // JSON.parse 失敗時防禦性退回原始文字,不讓整條請求掛掉。
      try {
        const data = JSON.parse(raw)
        const purpose = body.purpose as StructuredPurpose
        // 先對「模型原始輸出」做 validateQuota,把 overshoot 記進 log(診斷模型遵從度)。
        const warnings = validateQuota(purpose, data)
        if (warnings.length > 0) {
          console.warn(`[generate/copy] ${purpose} 滿配/字數警告:`, warnings)
        }
        // 再用智慧截斷兜底:模型壓不住的超字欄位切在句界、保證不超上限,然後才序列化。
        const clipped = clipStructured(purpose, data)
        copyText = serializeSections(purpose, clipped)
      } catch (parseErr) {
        console.warn('[generate/copy] 結構化 JSON 解析失敗,退回原始文字:', parseErr)
        copyText = raw
      }
    } else {
      copyText = raw
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
