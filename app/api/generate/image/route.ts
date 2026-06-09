import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { createClient } from '@/lib/supabase/server'
import { generateImage, type ReferenceImage } from '@/lib/gemini/image'
import {
  buildPrompt,
  buildLevel3Prompt,
  planLevel3Variations,
  getSceneById,
  type AdContent,
  type Level3Variation,
} from '@/lib/prompts/scene-templates'
import type {
  Asset,
  AspectRatio,
  AssetStore,
  CreativeScale,
  InputMode,
  SizePreset,
  StylePreset,
} from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60  // 多尺寸並行最久 60 秒

const STORES: AssetStore[] = ['mattress', 'bedding']
const MODES: InputMode[] = ['scene', 'reference', 'freeform']
const STYLES: StylePreset[] = ['hotel_dark', 'cozy_warm', 'minimal_clean', 'outdoor_natural', 'auto']
const CREATIVE_SCALES: CreativeScale[] = ['realistic', 'playful', 'surreal']
const VALID_SIZES: SizePreset[] = ['1080x1080', '1080x1350', '1080x1920', '1200x675', '1200x628', '1920x800']

// SizePreset → Gemini aspectRatio + 目標 pixel(會用 sharp 縮到精確尺寸)
const SIZE_TO_ASPECT: Record<SizePreset, { ratio: AspectRatio; w: number; h: number }> = {
  '1080x1080': { ratio: '1:1',    w: 1080, h: 1080 },
  '1080x1350': { ratio: '4:5',    w: 1080, h: 1350 },
  '1080x1920': { ratio: '9:16',   w: 1080, h: 1920 },
  '1200x675':  { ratio: '16:9',   w: 1200, h: 675  },
  '1200x628':  { ratio: '16:9',   w: 1200, h: 628  },  // 1.91:1 不支援,用 16:9 最近似 + sharp 裁到精確 pixel
  '1920x800':  { ratio: '21:9',   w: 1920, h: 800  },
}

// Gemini 2.5 Flash Image 支援的比例(只能挑這幾個,輸入會四捨五入到最接近)
const SUPPORTED_RATIOS: { name: AspectRatio; value: number }[] = [
  { name: '21:9', value: 21 / 9 },
  { name: '16:9', value: 16 / 9 },
  { name: '3:2',  value: 3 / 2 },
  { name: '4:3',  value: 4 / 3 },
  { name: '5:4',  value: 5 / 4 },
  { name: '1:1',  value: 1 },
  { name: '4:5',  value: 4 / 5 },
  { name: '3:4',  value: 3 / 4 },
  { name: '2:3',  value: 2 / 3 },
  { name: '9:16', value: 9 / 16 },
]

function closestSupportedRatio(w: number, h: number): AspectRatio {
  const target = w / h
  let best = SUPPORTED_RATIOS[0]
  let bestDiff = Math.abs(best.value - target)
  for (const r of SUPPORTED_RATIOS) {
    const diff = Math.abs(r.value - target)
    if (diff < bestDiff) { best = r; bestDiff = diff }
  }
  return best.name
}

// 統一的產圖 target:label(顯示用)+ 比例(送 Gemini)+ pixel(sharp 裁縮到) + level3 變體(若有)
type ImageTarget = {
  label: string
  ratio: AspectRatio
  w: number
  h: number
  variation?: Level3Variation
}

export async function POST(request: Request) {
  // 1. Auth
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 })

  // 2. 解析 multipart
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: '請求格式錯誤(需 multipart/form-data)' }, { status: 400 })
  }

  const mode = String(form.get('mode') ?? '') as InputMode
  const store = String(form.get('store') ?? '') as AssetStore
  const levelRaw = String(form.get('level') ?? 'level1')
  const level: 'level1' | 'level2' | 'level3' =
    levelRaw === 'level2' ? 'level2' : levelRaw === 'level3' ? 'level3' : 'level1'

  // Level 3 brief + 變體數量(只在 level3 用)
  const productBrief = String(form.get('productBrief') ?? '').trim()
  const catalogCount = Math.max(0, Math.min(3, parseInt(String(form.get('catalogCount') ?? '1'), 10) || 0))
  const lifestyleCount = Math.max(0, Math.min(6, parseInt(String(form.get('lifestyleCount') ?? '2'), 10) || 0))
  const sceneId = form.get('sceneId') ? String(form.get('sceneId')) : undefined
  const description = String(form.get('description') ?? '').trim()
  const freeformDesc = String(form.get('freeformDesc') ?? '').trim()
  const stylePresetRaw = String(form.get('stylePreset') ?? 'auto')
  const styleDesc = String(form.get('styleDesc') ?? '').trim()
  const creativeScaleRaw = String(form.get('creativeScale') ?? 'realistic')
  const creativeScale: CreativeScale = (CREATIVE_SCALES as string[]).includes(creativeScaleRaw)
    ? (creativeScaleRaw as CreativeScale)
    : 'realistic'
  const referenceImageFile = form.get('referenceImage')
  const productImageFile = form.get('productImage')  // 商品圖(全模式適用,商品本身保留,只重生背景)

  let sizes: SizePreset[]
  try {
    const raw = form.get('sizes')
    sizes = raw ? JSON.parse(String(raw)) : []
  } catch {
    return NextResponse.json({ error: 'sizes 格式錯誤' }, { status: 400 })
  }

  // Level 2 廣告文字(JSON):{title, subtitle?, endorsement?, features?: [{title, subtitle?}]}
  let adContent: AdContent | null = null
  try {
    const raw = form.get('adContent')
    if (raw) {
      const parsed = JSON.parse(String(raw))
      if (parsed && typeof parsed.title === 'string') {
        adContent = {
          title: parsed.title,
          subtitle: typeof parsed.subtitle === 'string' ? parsed.subtitle : undefined,
          endorsement: typeof parsed.endorsement === 'string' ? parsed.endorsement : undefined,
          features: Array.isArray(parsed.features)
            ? parsed.features
                .filter((f: unknown): f is { title: string; subtitle?: string } =>
                  typeof f === 'object' && f !== null && typeof (f as { title?: unknown }).title === 'string',
                )
                .slice(0, 3)
            : undefined,
        }
      }
    }
  } catch {
    return NextResponse.json({ error: 'adContent 格式錯誤' }, { status: 400 })
  }

  // 自訂尺寸(可選):{width: number, height: number}
  let customSize: { width: number; height: number } | null = null
  try {
    const raw = form.get('customSize')
    if (raw) {
      const parsed = JSON.parse(String(raw))
      if (parsed && typeof parsed.width === 'number' && typeof parsed.height === 'number') {
        customSize = { width: parsed.width, height: parsed.height }
      }
    }
  } catch {
    return NextResponse.json({ error: 'customSize 格式錯誤' }, { status: 400 })
  }

  // 3. 驗證
  if (!MODES.includes(mode)) return NextResponse.json({ error: 'mode 不合法' }, { status: 400 })
  if (!STORES.includes(store)) return NextResponse.json({ error: 'store 不合法' }, { status: 400 })

  // 至少要有 1 個 preset 或 1 個 customSize
  if ((!Array.isArray(sizes) || sizes.length === 0) && !customSize) {
    return NextResponse.json({ error: '請至少選擇一個尺寸或填寫自訂尺寸' }, { status: 400 })
  }
  for (const s of sizes) {
    if (!VALID_SIZES.includes(s)) {
      return NextResponse.json({ error: `尺寸不合法: ${s}` }, { status: 400 })
    }
  }
  if (customSize) {
    if (customSize.width < 256 || customSize.width > 4096 || customSize.height < 256 || customSize.height > 4096) {
      return NextResponse.json({ error: '自訂尺寸需在 256-4096 範圍內' }, { status: 400 })
    }
    if (!Number.isInteger(customSize.width) || !Number.isInteger(customSize.height)) {
      return NextResponse.json({ error: '自訂尺寸需為整數' }, { status: 400 })
    }
  }
  if (mode === 'scene' && !sceneId) {
    return NextResponse.json({ error: 'scene 模式需指定 sceneId' }, { status: 400 })
  }
  if (mode === 'freeform' && !freeformDesc) {
    return NextResponse.json({ error: '請輸入場景描述' }, { status: 400 })
  }
  if (mode === 'reference' && !(referenceImageFile instanceof File)) {
    return NextResponse.json({ error: '請上傳參考圖片' }, { status: 400 })
  }
  if (level === 'level2' && (!adContent || !adContent.title.trim())) {
    return NextResponse.json({ error: 'Level 2 完整廣告需提供主標題' }, { status: 400 })
  }
  if (level === 'level3') {
    if (!productBrief) {
      return NextResponse.json({ error: 'Level 3 需提供商品 brief' }, { status: 400 })
    }
    if (catalogCount + lifestyleCount === 0) {
      return NextResponse.json({ error: 'Level 3 至少需 1 張目錄或情境圖' }, { status: 400 })
    }
    if (catalogCount + lifestyleCount > 6) {
      return NextResponse.json({ error: 'Level 3 變體總數不可超過 6' }, { status: 400 })
    }
  }

  // 4. 處理 stylePreset(UI 的 'custom' 對應後端 'auto' + 把 styleDesc 串進 additionalNotes)
  const stylePreset: StylePreset = (STYLES as string[]).includes(stylePresetRaw)
    ? (stylePresetRaw as StylePreset)
    : 'auto'
  const isCustomStyle = stylePresetRaw === 'custom' && styleDesc.length > 0

  // 5. 場景模板(若是 scene 模式)
  let sceneTemplate = undefined
  if (mode === 'scene' && sceneId && sceneId !== 'freeform') {
    sceneTemplate = getSceneById(sceneId)
    if (!sceneTemplate) {
      return NextResponse.json({ error: `場景模板不存在: ${sceneId}` }, { status: 400 })
    }
  }
  // sceneId === 'freeform' 視為 freeform 模式處理(UI 上 scene tab 內的自由描述)
  const effectiveMode: InputMode =
    mode === 'scene' && sceneId === 'freeform' ? 'freeform' : mode
  const effectiveFreeformDesc =
    effectiveMode === 'freeform'
      ? (mode === 'freeform' ? freeformDesc : description)
      : undefined

  // 6. 預備參考圖
  // - 商品圖(productImage):全模式皆可,作為「主角」傳給 model — 順序固定第 1 張
  // - 場景參考圖(referenceImage):僅 reference 模式 — 第 2 張(若兩者都有)
  const referenceImagesList: ReferenceImage[] = []
  let productImageStorageUrl: string | null = null
  let referenceImageStorageUrl: string | null = null
  let hasProductImage = false
  let hasReferenceImage = false
  let refRatio: string | null = null  // 參考圖比例(closest supported)— 比對輸出比例觸發 outpaint

  if (productImageFile instanceof File && productImageFile.size > 0) {
    if (productImageFile.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: '商品圖超過 5MB 上限' }, { status: 400 })
    }
    const buf = Buffer.from(await productImageFile.arrayBuffer())
    const mimeType = productImageFile.type || 'image/jpeg'
    referenceImagesList.push({ data: buf.toString('base64'), mimeType })
    hasProductImage = true

    const path = `${user.id}/products/${Date.now()}-${sanitizeFilename(productImageFile.name || 'product.jpg')}`
    const { error: upErr } = await supabase.storage
      .from('generated-images')
      .upload(path, buf, { contentType: mimeType, upsert: false })
    if (!upErr) {
      const { data: pub } = supabase.storage.from('generated-images').getPublicUrl(path)
      productImageStorageUrl = pub.publicUrl
    }
  }

  if (mode === 'reference' && referenceImageFile instanceof File && referenceImageFile.size > 0) {
    if (referenceImageFile.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: '參考圖超過 5MB 上限' }, { status: 400 })
    }
    const buf = Buffer.from(await referenceImageFile.arrayBuffer())
    const mimeType = referenceImageFile.type || 'image/jpeg'
    referenceImagesList.push({ data: buf.toString('base64'), mimeType })
    hasReferenceImage = true

    // 量參考圖實際尺寸→算最接近的支援比例(用來判斷是否要 outpaint)
    try {
      const meta = await sharp(buf).metadata()
      if (meta.width && meta.height) {
        refRatio = closestSupportedRatio(meta.width, meta.height)
      }
    } catch {
      // 量不到不致命,continue with refRatio = null
    }

    const path = `${user.id}/refs/${Date.now()}-${sanitizeFilename(referenceImageFile.name || 'ref.jpg')}`
    const { error: upErr } = await supabase.storage
      .from('generated-images')
      .upload(path, buf, { contentType: mimeType, upsert: false })
    if (!upErr) {
      const { data: pub } = supabase.storage.from('generated-images').getPublicUrl(path)
      referenceImageStorageUrl = pub.publicUrl
    }
  }

  const referenceImages = referenceImagesList.length > 0 ? referenceImagesList : undefined

  // 7. 統一目標清單
  // Level 1/2: 一個 size = 一張圖
  // Level 3: 每個 size × 每個變體 = 一張圖(e.g. 1080x1080 × {1 catalog, 2 lifestyle} = 3 張)
  const baseSizes: { label: string; ratio: AspectRatio; w: number; h: number }[] = []
  for (const s of sizes) {
    const cfg = SIZE_TO_ASPECT[s]
    baseSizes.push({ label: s, ratio: cfg.ratio, w: cfg.w, h: cfg.h })
  }
  if (customSize) {
    baseSizes.push({
      label: `${customSize.width}x${customSize.height}`,
      ratio: closestSupportedRatio(customSize.width, customSize.height),
      w: customSize.width,
      h: customSize.height,
    })
  }

  const targets: ImageTarget[] = []
  if (level === 'level3') {
    const variations = planLevel3Variations(catalogCount, lifestyleCount, store)
    for (const sz of baseSizes) {
      for (const v of variations) {
        targets.push({
          label: `${sz.label}-${v.kind}${v.kind === 'lifestyle' ? `-${v.index}` : ''}`,
          ratio: sz.ratio,
          w: sz.w,
          h: sz.h,
          variation: v,
        })
      }
    }
  } else {
    for (const sz of baseSizes) targets.push(sz)
  }

  // 8. 對每個 target 並行產圖
  const additionalNotes = [
    description && mode !== 'freeform' ? description : '',
    isCustomStyle ? `Style direction: ${styleDesc}` : '',
  ].filter(Boolean).join(' ')

  const tasks = targets.map(async (target): Promise<
    | { ok: true; asset: Asset; label: string }
    | { ok: false; label: string; error: string }
  > => {
    try {
      const prompt = level === 'level3' && target.variation
        ? buildLevel3Prompt({
            brief: productBrief,
            store,
            variation: target.variation,
            hasProductImage,
            creativeScale,
          })
        : buildPrompt({
            mode: effectiveMode,
            store,
            sceneTemplate,
            freeformDescription: effectiveFreeformDesc,
            stylePreset,
            creativeScale,
            additionalNotes: additionalNotes || undefined,
            hasProductImage,
            hasReferenceImage,
            level: level === 'level3' ? 'level1' : level,  // 不會走到,但 TS 滿足
            adContent: adContent || undefined,
            refRatio: refRatio || undefined,
            outputRatio: target.ratio,
          })

      const result = await generateImage({
        prompt,
        aspectRatio: target.ratio,
        referenceImages,
      })

      // sharp 縮到精確 pixel(cover fit:填滿目標,多餘部分裁掉,不變形)
      const rawBuf = Buffer.from(result.base64, 'base64')
      const resizedBuf = await sharp(rawBuf)
        .resize(target.w, target.h, { fit: 'cover', position: 'centre' })
        .png({ compressionLevel: 9 })
        .toBuffer()

      const filename = `${user.id}/${Date.now()}-${target.label}-${randomId()}.png`
      const { error: upErr } = await supabase.storage
        .from('generated-images')
        .upload(filename, resizedBuf, { contentType: 'image/png', upsert: false })
      if (upErr) throw new Error(`圖檔上傳失敗: ${upErr.message}`)

      const { data: pub } = supabase.storage.from('generated-images').getPublicUrl(filename)
      const imageUrl = pub.publicUrl

      // 寫 assets 表
      const { data: asset, error: dbErr } = await supabase
        .from('assets')
        .insert({
          user_id: user.id,
          type: 'image',
          store,
          purpose: 'post',  // 圖片預設用途,使用者可在素材庫改
          image_url: imageUrl,
          image_level: (level === 'level2' || level === 'level3') ? 'level2_complete' : 'level1_base',
          aspect_ratio: target.ratio,
          width: target.w,
          height: target.h,
          prompt_used: prompt,
          source: referenceImages ? 'reference_remix' : 'ai_generated',
          // 商品圖優先記錄(更重要的可追溯資訊);若只有場景參考圖則記錄該 URL
          reference_image_url: productImageStorageUrl || referenceImageStorageUrl,
          tags: target.variation ? [target.variation.kind] : [],
        })
        .select()
        .single()

      if (dbErr) throw new Error(`資料庫寫入失敗: ${dbErr.message}`)
      return { ok: true, asset: asset as Asset, label: target.label }
    } catch (e: any) {
      return { ok: false, label: target.label, error: e?.message || '未知錯誤' }
    }
  })

  const settled = await Promise.all(tasks)
  const assets = settled.filter((r): r is { ok: true; asset: Asset; label: string } => r.ok).map(r => r.asset)
  const errors = settled.filter((r): r is { ok: false; label: string; error: string } => !r.ok)

  return NextResponse.json({
    assets,
    errors: errors.map(e => ({ size: e.label, error: e.error })),
    successCount: assets.length,
    failedCount: errors.length,
  })
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)
}
