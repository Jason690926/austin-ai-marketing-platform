// Gemini 3.1 Flash Image (Nano Banana 2) — REST API client
// 用 raw fetch 而非 SDK,因為 @google/generative-ai v0.24.1 不支援圖片生成,
// 而升級到 @google/genai 會牽動現有文案路徑。獨立檔案隔離,日後好替換。

import type { AspectRatio } from '@/types'

// 預設 Nano Banana 2(2026-02 GA):中文字渲染、指令遵循大幅優於舊版 2.5 Flash Image。
// 可用 GEMINI_IMAGE_MODEL 覆寫(降回 gemini-2.5-flash-image 省成本,或升 gemini-3-pro-image-preview 求最高品質)。
export const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image-preview'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

export interface ReferenceImage {
  data: string       // base64(不含 data: 前綴)
  mimeType: string   // image/jpeg | image/png | image/webp
}

export interface GenerateImageResult {
  base64: string     // 產出的圖,base64 編碼(不含 data: 前綴)
  mimeType: string   // 通常 image/png
}

// 可重試的 finishReason — Gemini 已知 flaky 錯誤,重跑常就過
const RETRYABLE_FINISH_REASONS = new Set([
  'MALFORMED_FUNCTION_CALL',  // 長 prompt 偶爾被誤判為 tool call,單純重試
  'OTHER',                    // Gemini 偶發 OTHER finishReason,常常重試就好
])

/**
 * 呼叫 Gemini 2.5 Flash Image 產一張圖。
 * - 文字 prompt 必填
 * - 可選 1-3 張參考圖(2.5 Flash 模型上限 3 張)
 * - 可選比例(預設 1:1)
 * - 遇 MALFORMED_FUNCTION_CALL / OTHER 等 flaky finishReason 自動重試最多 2 次
 *
 * 失敗時 throw,error message 含 HTTP status + Google 回傳訊息,方便排查。
 */
export async function generateImage(opts: {
  prompt: string
  aspectRatio?: AspectRatio
  referenceImages?: ReferenceImage[]
}): Promise<GenerateImageResult> {
  let lastError: Error | null = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await generateImageOnce(opts)
    } catch (e) {
      const err = e as Error
      lastError = err
      const msg = String(err.message || err)
      let isRetryable = false
      RETRYABLE_FINISH_REASONS.forEach(r => { if (msg.includes(r)) isRetryable = true })
      if (!isRetryable || attempt === 3) throw err
      // 簡單退避(指數):500ms / 2000ms
      await new Promise(r => setTimeout(r, attempt * attempt * 500))
    }
  }
  throw lastError!
}

async function generateImageOnce(opts: {
  prompt: string
  aspectRatio?: AspectRatio
  referenceImages?: ReferenceImage[]
}): Promise<GenerateImageResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set in .env.local')

  const parts: any[] = [{ text: opts.prompt }]
  for (const ref of opts.referenceImages || []) {
    parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.data } })
  }

  const body: any = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      ...(opts.aspectRatio
        ? { imageConfig: { aspectRatio: opts.aspectRatio } }
        : {}),
    },
  }

  const url = `${API_BASE}/${IMAGE_MODEL}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Gemini Image API ${res.status}: ${errText.slice(0, 500)}`)
  }

  const json: any = await res.json()

  // 找回應 parts 裡的 inlineData(圖片二進位)
  const candidateParts = json?.candidates?.[0]?.content?.parts || []
  for (const p of candidateParts) {
    if (p?.inlineData?.data) {
      return {
        base64: p.inlineData.data,
        mimeType: p.inlineData.mimeType || 'image/png',
      }
    }
  }

  // 若連 parts 都沒有,把 finishReason / safety blocking 訊息丟回去
  const finishReason = json?.candidates?.[0]?.finishReason
  const safetyRatings = json?.candidates?.[0]?.safetyRatings
  throw new Error(
    `Gemini 未產出圖片 (finishReason=${finishReason || 'UNKNOWN'})${
      safetyRatings ? `,safety: ${JSON.stringify(safetyRatings)}` : ''
    }`,
  )
}
