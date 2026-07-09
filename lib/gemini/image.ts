// Gemini Nano Banana — REST API client
// 用 raw fetch 而非 SDK,因為 @google/generative-ai v0.24.1 不支援圖片生成,
// 而升級到 @google/genai 會牽動現有文案路徑。獨立檔案隔離,日後好替換。

import type { AspectRatio } from '@/types'

// 預設 Nano Banana 2(GA):速度/成本佳,用於無燒字的 Level 1 底圖。
// 可用 GEMINI_IMAGE_MODEL 覆寫(降回 gemini-2.5-flash-image 省成本)。
export const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image'

// 燒字用途(Level 2 完整廣告 / Level 3 自主)走 Nano Banana Pro(Gemini 3 Pro Image,GA)。
// Pro 的 thinking 模式會先規劃版面再渲染,中文字保真度與指令遵循遠勝 Flash,專治「燒進圖的中文字錯字/變形」。
// 成本較高(~$0.134/張 vs Flash ~$0.045);想全程省成本可用 GEMINI_IMAGE_MODEL_PRO=gemini-3.1-flash-image 降回 Flash。
export const IMAGE_MODEL_PRO = process.env.GEMINI_IMAGE_MODEL_PRO || 'gemini-3-pro-image'

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

// 可重試的 HTTP 錯誤:429 rate limit(多張並行最常見)、5xx 暫時性故障
const RETRYABLE_HTTP_STATUS = /Gemini Image API (429|500|502|503)/

// 單次呼叫上限:Pro thinking 模式單張可到 30-60 秒,設 120 秒防吊死
const FETCH_TIMEOUT_MS = 120_000

/**
 * 呼叫 Gemini Nano Banana 產一張圖(模型由 opts.model 決定,預設 IMAGE_MODEL)。
 * - 文字 prompt 必填
 * - 可選參考圖(Flash 上限 3 張、Pro 上限 14 張)
 * - 可選比例(預設 1:1)
 * - 最多嘗試 3 次:MALFORMED_FUNCTION_CALL / OTHER / 429 / 5xx / timeout 皆自動重試
 *   (429 用較長退避,其餘指數退避)
 *
 * 失敗時 throw,error message 含 HTTP status + Google 回傳訊息,方便排查。
 */
export async function generateImage(opts: {
  prompt: string
  aspectRatio?: AspectRatio
  referenceImages?: ReferenceImage[]
  model?: string   // 覆寫模型(燒字用途傳 IMAGE_MODEL_PRO);省略則用 IMAGE_MODEL
}): Promise<GenerateImageResult> {
  let lastError: Error | null = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await generateImageOnce(opts)
    } catch (e) {
      const err = e as Error
      lastError = err
      const msg = String(err.message || err)
      const isRateLimited = msg.includes('Gemini Image API 429')
      const isTimeout = err.name === 'TimeoutError' || msg.includes('timeout')
      let isRetryable = isRateLimited || isTimeout || RETRYABLE_HTTP_STATUS.test(msg)
      RETRYABLE_FINISH_REASONS.forEach(r => { if (msg.includes(r)) isRetryable = true })
      if (!isRetryable || attempt === 3) throw err
      // 429 退避較長(4s/8s)讓 rate limit 窗口過去;其餘指數退避 500ms/2000ms
      const delay = isRateLimited ? attempt * 4000 : attempt * attempt * 500
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastError!
}

async function generateImageOnce(opts: {
  prompt: string
  aspectRatio?: AspectRatio
  referenceImages?: ReferenceImage[]
  model?: string
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

  const url = `${API_BASE}/${opts.model || IMAGE_MODEL}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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
