import { describe, it, expect } from 'vitest'
import {
  STRUCTURED_SCHEMAS,
  serializeSections,
  validateQuota,
  clipToLimit,
  clipStructured,
  type AdData,
  type RsaData,
  type PmaxData,
  type SeoData,
} from './structured-output'
import { parseSections } from './parse-sections'

// 複製 app/api/sheets/push-meta-ad/route.ts 內那份「嚴格」解析器:
// 要求【標頭】獨佔一行 (/^\s*【…】\s*$/gm)。serializer 必須相容這份,否則 Sheet 推送會壞。
function parseStrict(text: string): Map<string, string> {
  const headerRe = /^\s*【([^】\n]+)】\s*$/gm
  const matches = Array.from(text.matchAll(headerRe))
  const result = new Map<string, string>()
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const title = m[1].trim()
    const start = (m.index ?? 0) + m[0].length
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length
    result.set(title, text.slice(start, end).trim())
  }
  return result
}

const SAMPLE_AD: AdData = {
  primaryText: '又是熱到睡不著的一夜？\n\n換上涼感床墊,一躺下就有感。\n\n限時 8 折,免運到府。\n\n今晚就升級 👇',
  headlines: ['整夜涼感好眠', '8 折限時下殺'],
  description: '3 段獨立筒撐起整夜好眠',
  cta: '立即選購',
}

const SAMPLE_RSA: RsaData = {
  headlines: Array.from({ length: 15 }, (_, i) => `搜尋標題第 ${i + 1} 組`),
  descriptions: Array.from({ length: 4 }, (_, i) => `說明第 ${i + 1} 組,強調利益與行動`),
  paths: ['涼感床墊', '限時優惠'],
  keywords: '涼感床墊, 獨立筒, 透氣',
}

const SAMPLE_PMAX: PmaxData = {
  shortHeadlines: Array.from({ length: 15 }, (_, i) => `短標 ${i + 1}`),
  longHeadlines: Array.from({ length: 5 }, (_, i) => `長標題第 ${i + 1} 組`),
  descriptions: Array.from({ length: 5 }, (_, i) => `說明第 ${i + 1} 組`),
  shortDescription: '涼感獨立筒床墊',
  businessName: '席樂頓名床',
  cta: '立即選購',
}

const SAMPLE_SEO: SeoData = {
  h1: '夏天怎麼挑涼感床墊?',
  metaTitle: '涼感床墊選購指南',
  metaDescription: '想在夏天睡得清爽?本文整理涼感床墊的挑選重點與材質比較。',
  urlSlug: 'cooling-mattress-guide',
  keywords: '涼感床墊, 獨立筒, 透氣',
  articleBody: '## 為什麼夏天難睡\n悶熱是主因。\n\n### 涼感材質怎麼挑\n看透氣結構。',
  faq: [
    { question: '涼感床墊真的有用嗎?', answer: '透氣結構能減少悶熱感。' },
    { question: '怎麼清潔?', answer: '定期通風即可。' },
    { question: '保固多久?', answer: '依型號而定。' },
  ],
}

describe('serializeSections — 標準格式', () => {
  it('每個區塊標頭獨佔一行,區塊間有空行', () => {
    const out = serializeSections('ad', SAMPLE_AD)
    // 標頭獨佔一行
    expect(out).toMatch(/^【Primary Text】$/m)
    expect(out).toMatch(/^【Headline 1】$/m)
    expect(out).toMatch(/^【Headline 2】$/m)
    expect(out).toMatch(/^【Description】$/m)
    expect(out).toMatch(/^【CTA】$/m)
    // 區塊間有空行
    expect(out).toContain('\n\n【Headline 1】')
  })
})

describe('serializeSections → parseSections round-trip（寬鬆解析器）', () => {
  it('ad 還原成 5 個區塊,內容對得上', () => {
    const sections = parseSections(serializeSections('ad', SAMPLE_AD))
    const titles = sections.map(s => s.title)
    expect(titles).toEqual(['Primary Text', 'Headline 1', 'Headline 2', 'Description', 'CTA'])
    expect(sections.find(s => s.title === 'Headline 1')?.content).toBe('整夜涼感好眠')
    // Primary Text 的段落空行要保留
    expect(sections.find(s => s.title === 'Primary Text')?.content).toContain('\n\n')
  })

  it('RSA 還原成 15 標題 + 4 說明 + 2 路徑 + 關鍵字', () => {
    const sections = parseSections(serializeSections('google_search_ad', SAMPLE_RSA))
    const titles = sections.map(s => s.title)
    for (let i = 1; i <= 15; i++) expect(titles).toContain(`Headline ${i}`)
    for (let i = 1; i <= 4; i++) expect(titles).toContain(`Description ${i}`)
    expect(titles).toContain('Path 1')
    expect(titles).toContain('Path 2')
    expect(titles).toContain('Keywords')
    expect(sections.find(s => s.title === 'Headline 8')?.content).toBe('搜尋標題第 8 組')
  })

  it('PMax 還原成 15 短標 + 5 長標 + 5 說明 + 短說明 + 商家名 + CTA', () => {
    const sections = parseSections(serializeSections('pmax_ad', SAMPLE_PMAX))
    const titles = sections.map(s => s.title)
    for (let i = 1; i <= 15; i++) expect(titles).toContain(`Short Headline ${i}`)
    for (let i = 1; i <= 5; i++) expect(titles).toContain(`Long Headline ${i}`)
    for (let i = 1; i <= 5; i++) expect(titles).toContain(`Description ${i}`)
    expect(titles).toContain('Short Description')
    expect(titles).toContain('Business Name')
    expect(titles).toContain('CTA')
  })

  it('SEO 還原成 7 個區塊,FAQ 內含問答', () => {
    const sections = parseSections(serializeSections('seo_article', SAMPLE_SEO))
    const titles = sections.map(s => s.title)
    expect(titles).toEqual(['H1', 'Meta Title', 'Meta Description', 'URL Slug', 'Keywords', 'Article Body', 'FAQ'])
    const faq = sections.find(s => s.title === 'FAQ')?.content ?? ''
    expect(faq).toContain('涼感床墊真的有用嗎?')
    expect(faq).toContain('透氣結構能減少悶熱感。')
    // Article Body 的 markdown 結構保留
    expect(sections.find(s => s.title === 'Article Body')?.content).toContain('## 為什麼夏天難睡')
  })
})

describe('serializeSections — 相容 Sheet 推送的嚴格解析器', () => {
  it('ad 序列化結果可被嚴格 regex 取到關鍵欄位', () => {
    const m = parseStrict(serializeSections('ad', SAMPLE_AD))
    expect(m.get('Primary Text')).toBeTruthy()
    expect(m.get('Headline 1')).toBe('整夜涼感好眠')
    expect(m.get('Description')).toBe('3 段獨立筒撐起整夜好眠')
    expect(m.get('CTA')).toBe('立即選購')
  })
})

describe('STRUCTURED_SCHEMAS — 滿配數量鎖在 schema 層', () => {
  it('RSA headlines 鎖 15、descriptions 鎖 4', () => {
    const p = (STRUCTURED_SCHEMAS.google_search_ad as any).properties
    expect(p.headlines.minItems).toBe(15)
    expect(p.headlines.maxItems).toBe(15)
    expect(p.descriptions.minItems).toBe(4)
    expect(p.descriptions.maxItems).toBe(4)
  })

  it('PMax shortHeadlines 鎖 15、longHeadlines 鎖 5、descriptions 鎖 5', () => {
    const p = (STRUCTURED_SCHEMAS.pmax_ad as any).properties
    expect(p.shortHeadlines.minItems).toBe(15)
    expect(p.longHeadlines.minItems).toBe(5)
    expect(p.descriptions.minItems).toBe(5)
  })

  it('每個 schema 都是 OBJECT 且有 required', () => {
    for (const purpose of ['ad', 'google_search_ad', 'pmax_ad', 'seo_article'] as const) {
      const s = STRUCTURED_SCHEMAS[purpose] as any
      expect(s.type).toBe('object')
      expect(Array.isArray(s.required)).toBe(true)
      expect(s.required.length).toBeGreaterThan(0)
    }
  })
})

describe('validateQuota — 後驗證（非致命警告）', () => {
  it('合格樣本沒有警告', () => {
    expect(validateQuota('ad', SAMPLE_AD)).toEqual([])
    expect(validateQuota('google_search_ad', SAMPLE_RSA)).toEqual([])
  })

  it('ad headline 超 25 中文字 → 有警告', () => {
    const bad: AdData = { ...SAMPLE_AD, headlines: ['這是一個明顯超過二十五個中文字限制的超長標題實在是太長了喔喔喔喔', '正常標題'] }
    const warns = validateQuota('ad', bad)
    expect(warns.length).toBeGreaterThan(0)
    expect(warns.join()).toMatch(/Headline/)
  })

  it('RSA 標題數量不足 15 → 有警告', () => {
    const bad: RsaData = { ...SAMPLE_RSA, headlines: SAMPLE_RSA.headlines.slice(0, 10) }
    const warns = validateQuota('google_search_ad', bad)
    expect(warns.length).toBeGreaterThan(0)
  })

  it('缺欄位（空字串）→ 有警告', () => {
    const bad: AdData = { ...SAMPLE_AD, cta: '' }
    expect(validateQuota('ad', bad).length).toBeGreaterThan(0)
  })
})

describe('clipToLimit — 智慧截斷（句界優先）', () => {
  it('未超字 → 原樣返回', () => {
    expect(clipToLimit('短句不超字', 10)).toBe('短句不超字')
  })

  it('超字 → 截到上限以內（code point 計）', () => {
    const s = '一二三四五六七八九十一二三四五六七八九十'
    expect(Array.from(clipToLimit(s, 12)).length).toBeLessThanOrEqual(12)
  })

  it('切在連接性標點（逗號）→ 去掉尾逗號收乾淨,不留斷尾', () => {
    const s = '這是一段測試文字剛好十六個，後面還有更多文字需要被截斷掉'
    const out = clipToLimit(s, 20)
    expect(Array.from(out).length).toBeLessThanOrEqual(20)
    expect(out.endsWith('，')).toBe(false)
    expect(out.endsWith('個')).toBe(true)
  })

  it('切在句末標點（句號）→ 保留句號', () => {
    const s = '前面是一段完整的句子結束了。後面又有更多文字超過上限需要截斷'
    const out = clipToLimit(s, 20)
    expect(Array.from(out).length).toBeLessThanOrEqual(20)
    expect(out.endsWith('。')).toBe(true)
  })

  it('標點太早（保留太少）→ 改硬切到上限,不浪費長度', () => {
    const s = '短，這後面是一段很長很長沒有任何標點符號的內容會一直延伸下去到超過上限'
    const out = clipToLimit(s, 20)
    // 標點在第 2 字,保留 2 字太少 → 應硬切到接近上限而非只留「短，」
    expect(Array.from(out).length).toBeGreaterThan(10)
    expect(Array.from(out).length).toBeLessThanOrEqual(20)
  })
})

describe('clipStructured — 對超字欄位套用截斷', () => {
  it('RSA 超字說明被截到 ≤ 45,標題數量與內容不變', () => {
    const longDesc = 'SNOOPY奶霜極涼被，涼感全面升級，今年凍一夏！即刻體驗清涼，原價3480現享2480元。限時優惠中！'
    const data: RsaData = { ...SAMPLE_RSA, descriptions: [longDesc, ...SAMPLE_RSA.descriptions.slice(1)] }
    const clipped = clipStructured('google_search_ad', data) as RsaData
    expect(Array.from(clipped.descriptions[0]).length).toBeLessThanOrEqual(45)
    expect(clipped.headlines.length).toBe(15)
    expect(clipped.headlines[0]).toBe(SAMPLE_RSA.headlines[0])
  })

  it('截斷後 validateQuota 不再有超字警告', () => {
    const longDesc = 'SNOOPY奶霜極涼被，涼感全面升級，今年凍一夏！即刻體驗清涼，原價3480現享2480元。限時優惠中！'
    const data: RsaData = { ...SAMPLE_RSA, descriptions: [longDesc, ...SAMPLE_RSA.descriptions.slice(1)] }
    const clipped = clipStructured('google_search_ad', data)
    expect(validateQuota('google_search_ad', clipped).filter(w => w.includes('超字'))).toEqual([])
  })

  it('未超字資料 → 原樣（內容不變）', () => {
    const clipped = clipStructured('ad', SAMPLE_AD) as AdData
    expect(clipped.headlines).toEqual(SAMPLE_AD.headlines)
    expect(clipped.description).toBe(SAMPLE_AD.description)
  })
})
