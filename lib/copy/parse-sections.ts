// 解析 copywriter prompt 規定的【區塊名】內容格式。
// 用於廣告類 / SEO 類 purpose 的結構化輸出，方便 UI 分區顯示與獨立複製。

export interface CopySection {
  title: string   // 區塊名，不含方頭括弧
  content: string // 區塊內容（已 trim）
}

/**
 * 將 LLM 輸出依「【區塊名】」分段。
 * - 不符合區塊格式（沒有任何【...】）→ 回傳 []
 * - 一個區塊後緊接內容（可多行）直到下一個「【...】」或文字結尾
 */
export function parseSections(text: string): CopySection[] {
  if (!text) return []

  // 比對行首的【XXX】（容許前後空白）
  const headerRe = /^\s*【([^】\n]+)】\s*$/gm
  const matches = Array.from(text.matchAll(headerRe))
  if (matches.length === 0) return []

  const sections: CopySection[] = []
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const title = m[1].trim()
    const start = (m.index ?? 0) + m[0].length
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length
    const content = text.slice(start, end).trim()
    if (title) sections.push({ title, content })
  }
  return sections
}

/** 判斷 purpose 是否預期使用區塊格式輸出。 */
const STRUCTURED_PURPOSES = new Set(['ad', 'google_search_ad', 'pmax_ad', 'seo_article'])

export function isStructuredPurpose(purpose: string): boolean {
  return STRUCTURED_PURPOSES.has(purpose)
}
