// 待辦 D — Structured JSON Output。
// 為廣告/SEO 類用途定義 Gemini responseSchema(強制結構 + 滿配),並把回傳的 JSON
// 序列化成「標準格式」的【區塊名】文字存進 copy_text。流程:
//   Gemini responseSchema → 保證結構的 JSON → validateQuota 後驗證 → serializeSections → copy_text
// 這樣 copy_text 仍是唯一真實來源,所有既有消費者(parseSections / Sheet 推送 / 素材庫 / 發布)不動照常運作,
// 而格式由我方受控 serializer 產出,RSA 那類「標頭與內容同行」的解析脆弱在物理上不再發生。

import { SchemaType, type ResponseSchema } from '@google/generative-ai'

export type StructuredPurpose = 'ad' | 'google_search_ad' | 'pmax_ad' | 'seo_article'

// ── 各用途的資料形狀(對應 schema)──────────────────────────────
export interface AdData {
  primaryText: string
  headlines: string[] // 剛好 2 組
  description: string
  cta: string
}

export interface RsaData {
  headlines: string[] // 滿配 15
  descriptions: string[] // 滿配 4
  paths: string[] // 2
  keywords: string
}

export interface PmaxData {
  shortHeadlines: string[] // 滿配 15
  longHeadlines: string[] // 滿配 5
  descriptions: string[] // 滿配 5
  shortDescription: string
  businessName: string
  cta: string
}

export interface SeoFaqItem {
  question: string
  answer: string
}

export interface SeoData {
  h1: string
  metaTitle: string
  metaDescription: string
  urlSlug: string
  keywords: string
  articleBody: string
  faq: SeoFaqItem[] // 3–5
}

// ── Schema 小工具 ────────────────────────────────────────────
const str = (description: string): ResponseSchema =>
  ({ type: SchemaType.STRING, description } as ResponseSchema)

const strArray = (
  min: number,
  max: number,
  itemDescription: string,
): ResponseSchema =>
  ({
    type: SchemaType.ARRAY,
    minItems: min,
    maxItems: max,
    items: { type: SchemaType.STRING, description: itemDescription },
  } as unknown as ResponseSchema)

// ── responseSchema 定義 ──────────────────────────────────────
// 字數限制無法在 schema 強制(StringSchema 無 maxLength),改寫進 description 指令 + validateQuota 後驗證。
export const STRUCTURED_SCHEMAS: Record<StructuredPurpose, ResponseSchema> = {
  ad: {
    type: SchemaType.OBJECT,
    properties: {
      primaryText: str('Meta 廣告主文案,80–150 字,用空行分 3–4 段,嵌 3–5 個 emoji,降低廣告感'),
      headlines: strArray(2, 2, '短標題,每則 ≤ 25 中文字;兩組角度必須完全不同(如情感 vs 功能)'),
      description: str('連結說明,≤ 30 中文字,不可以品牌名開頭,角度與主文案/標題差異化'),
      cta: str('行動呼籲短字串,依 CTA 導向選用'),
    },
    required: ['primaryText', 'headlines', 'description', 'cta'],
  } as unknown as ResponseSchema,

  google_search_ad: {
    type: SchemaType.OBJECT,
    properties: {
      headlines: strArray(15, 15, 'RSA 標題,每則 ≤ 15 中文字,含主關鍵字,15 組角度各不相同'),
      descriptions: strArray(4, 4, 'RSA 說明,每則 ≤ 45 中文字,強調利益 + 行動'),
      paths: strArray(2, 2, '顯示網址路徑,每段 ≤ 7 中文字'),
      keywords: str('建議搭配關鍵字,逗號分隔'),
    },
    required: ['headlines', 'descriptions', 'paths', 'keywords'],
  } as unknown as ResponseSchema,

  pmax_ad: {
    type: SchemaType.OBJECT,
    properties: {
      shortHeadlines: strArray(15, 15, '短標題,每則 ≤ 15 中文字,15 組差異化角度'),
      longHeadlines: strArray(5, 5, '長標題,每則 ≤ 45 中文字'),
      descriptions: strArray(5, 5, '說明,每則 ≤ 45 中文字'),
      shortDescription: str('短說明,≤ 30 中文字(符合 PMax 短說明要求)'),
      businessName: str('商家名稱,≤ 12 中文字'),
      cta: str('行動呼籲短字串'),
    },
    required: ['shortHeadlines', 'longHeadlines', 'descriptions', 'shortDescription', 'businessName', 'cta'],
  } as unknown as ResponseSchema,

  seo_article: {
    type: SchemaType.OBJECT,
    properties: {
      h1: str('文章主標題 H1'),
      metaTitle: str('Meta Title,≤ 30 中文字'),
      metaDescription: str('Meta Description,≤ 80 中文字'),
      urlSlug: str('URL Slug,英文小寫加連字號'),
      keywords: str('主關鍵字 + 長尾,逗號分隔'),
      articleBody: str('文章內文,500–800 字,可用 ## H2 / ### H3,先給直接答案再補充,自然嵌入關鍵字'),
      faq: {
        type: SchemaType.ARRAY,
        minItems: 3,
        maxItems: 5,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            question: { type: SchemaType.STRING, description: '常見問題' },
            answer: { type: SchemaType.STRING, description: '簡潔回答,便於 AEO 摘要' },
          },
          required: ['question', 'answer'],
        },
      },
    },
    required: ['h1', 'metaTitle', 'metaDescription', 'urlSlug', 'keywords', 'articleBody', 'faq'],
  } as unknown as ResponseSchema,
}

// ── 序列化:JSON → 標準格式【區塊名】文字 ──────────────────────
// 規則:每個【標頭】獨佔一行、內容換行接續、區塊之間一個空行。
// 區塊名必須與下游(parse-sections 寬鬆解析 + sheets push 嚴格解析)期望的字串完全一致。
function block(title: string, content: string): string {
  return `【${title}】\n${(content ?? '').trim()}`
}

function asArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(x => String(x ?? '').trim()) : []
}

export function serializeSections(purpose: StructuredPurpose, data: any): string {
  const blocks: string[] = []

  if (purpose === 'ad') {
    const d = data as AdData
    blocks.push(block('Primary Text', d.primaryText))
    asArray(d.headlines).forEach((h, i) => blocks.push(block(`Headline ${i + 1}`, h)))
    blocks.push(block('Description', d.description))
    blocks.push(block('CTA', d.cta))
  } else if (purpose === 'google_search_ad') {
    const d = data as RsaData
    asArray(d.headlines).forEach((h, i) => blocks.push(block(`Headline ${i + 1}`, h)))
    asArray(d.descriptions).forEach((x, i) => blocks.push(block(`Description ${i + 1}`, x)))
    asArray(d.paths).forEach((x, i) => blocks.push(block(`Path ${i + 1}`, x)))
    blocks.push(block('Keywords', d.keywords))
  } else if (purpose === 'pmax_ad') {
    const d = data as PmaxData
    asArray(d.shortHeadlines).forEach((x, i) => blocks.push(block(`Short Headline ${i + 1}`, x)))
    asArray(d.longHeadlines).forEach((x, i) => blocks.push(block(`Long Headline ${i + 1}`, x)))
    asArray(d.descriptions).forEach((x, i) => blocks.push(block(`Description ${i + 1}`, x)))
    blocks.push(block('Short Description', d.shortDescription))
    blocks.push(block('Business Name', d.businessName))
    blocks.push(block('CTA', d.cta))
  } else {
    // seo_article
    const d = data as SeoData
    blocks.push(block('H1', d.h1))
    blocks.push(block('Meta Title', d.metaTitle))
    blocks.push(block('Meta Description', d.metaDescription))
    blocks.push(block('URL Slug', d.urlSlug))
    blocks.push(block('Keywords', d.keywords))
    blocks.push(block('Article Body', d.articleBody))
    const faq = Array.isArray(d.faq) ? d.faq : []
    const faqText = faq
      .map((f, i) => `Q${i + 1}：${(f?.question ?? '').trim()}\nA${i + 1}：${(f?.answer ?? '').trim()}`)
      .join('\n\n')
    blocks.push(block('FAQ', faqText))
  }

  return blocks.join('\n\n')
}

// ── 後驗證:回傳非致命警告(route 端只 log)─────────────────────
// 中文字數以 code point 計([...str].length),不信 Gemini 的 CJK 計數。
function len(s: string): number {
  // Array.from 以 code point 計(中文/emoji 各算 1);避免 string 展開觸發 downlevelIteration。
  return Array.from(s ?? '').length
}

interface ArraySpec {
  field: string
  label: string
  count: number
  limit: number
}

const QUOTA_RULES: Record<StructuredPurpose, { arrays: ArraySpec[]; strings: { field: string; label: string; limit: number }[] }> = {
  ad: {
    arrays: [{ field: 'headlines', label: 'Headline', count: 2, limit: 25 }],
    strings: [{ field: 'description', label: 'Description', limit: 30 }],
  },
  google_search_ad: {
    arrays: [
      { field: 'headlines', label: 'Headline', count: 15, limit: 15 },
      { field: 'descriptions', label: 'Description', count: 4, limit: 45 },
      { field: 'paths', label: 'Path', count: 2, limit: 7 },
    ],
    strings: [],
  },
  pmax_ad: {
    arrays: [
      { field: 'shortHeadlines', label: 'Short Headline', count: 15, limit: 15 },
      { field: 'longHeadlines', label: 'Long Headline', count: 5, limit: 45 },
      { field: 'descriptions', label: 'Description', count: 5, limit: 45 },
    ],
    strings: [
      { field: 'shortDescription', label: 'Short Description', limit: 30 },
      { field: 'businessName', label: 'Business Name', limit: 12 },
    ],
  },
  seo_article: {
    arrays: [],
    strings: [
      { field: 'metaTitle', label: 'Meta Title', limit: 30 },
      { field: 'metaDescription', label: 'Meta Description', limit: 80 },
    ],
  },
}

// 各用途必填的純字串欄位(空字串 = 缺欄位)。
const REQUIRED_STRINGS: Record<StructuredPurpose, string[]> = {
  ad: ['primaryText', 'description', 'cta'],
  google_search_ad: ['keywords'],
  pmax_ad: ['shortDescription', 'businessName', 'cta'],
  seo_article: ['h1', 'metaTitle', 'metaDescription', 'urlSlug', 'keywords', 'articleBody'],
}

export function validateQuota(purpose: StructuredPurpose, data: any): string[] {
  const warnings: string[] = []
  const rules = QUOTA_RULES[purpose]

  for (const spec of rules.arrays) {
    const arr = asArray(data?.[spec.field])
    if (arr.length < spec.count) {
      warnings.push(`${spec.label} 數量不足:應為 ${spec.count} 組,實際 ${arr.length} 組`)
    }
    arr.forEach((v, i) => {
      if (len(v) > spec.limit) {
        warnings.push(`${spec.label} ${i + 1} 超字:${len(v)} 字(上限 ${spec.limit}）`)
      }
    })
  }

  for (const s of rules.strings) {
    const v = String(data?.[s.field] ?? '')
    if (len(v) > s.limit) {
      warnings.push(`${s.label} 超字:${len(v)} 字(上限 ${s.limit}）`)
    }
  }

  for (const field of REQUIRED_STRINGS[purpose]) {
    if (!String(data?.[field] ?? '').trim()) {
      warnings.push(`缺少必填欄位:${field}`)
    }
  }

  if (purpose === 'seo_article') {
    const faq = Array.isArray(data?.faq) ? data.faq : []
    if (faq.length < 3) warnings.push(`FAQ 數量不足:應為 3–5 題,實際 ${faq.length} 題`)
  }

  return warnings
}
