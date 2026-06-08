// 解析 copywriter prompt 規定的【區塊名】內容格式。
// 用於廣告類 / SEO 類 purpose 的結構化輸出，方便 UI 分區顯示與獨立複製。

export interface CopySection {
  title: string   // 區塊名，不含方頭括弧
  content: string // 區塊內容（已 trim）
}

/**
 * 將 LLM 輸出依「【區塊名】」分段。
 * - 不符合區塊格式（沒有任何【...】）→ 回傳 []
 * - 同時支援兩種格式（模型短區塊常用前者、長區塊常用後者）：
 *     「【區塊名】內容」    ← 標頭與內容同一行（如 RSA 的 15 組短標題）
 *     「【區塊名】\n內容…」  ← 標頭獨佔一行，內容換到下一行（可多行，如 Primary Text）
 */
export function parseSections(text: string): CopySection[] {
  if (!text) return []

  // 行首的【XXX】，後面可選地「同一行」接內容（group 2）
  const headerRe = /^[ \t]*【([^】\n]+)】[ \t]*(.*)$/gm
  const matches = Array.from(text.matchAll(headerRe))
  if (matches.length === 0) return []

  const sections: CopySection[] = []
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const title = m[1].trim()
    const inline = (m[2] ?? '').trim()                       // 同一行的內容
    const lineEnd = (m.index ?? 0) + m[0].length             // 此標頭行結尾
    const nextStart = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length
    const rest = text.slice(lineEnd, nextStart).trim()       // 後續換行的內容
    const content = [inline, rest].filter(Boolean).join('\n').trim()
    if (title) sections.push({ title, content })
  }
  return sections
}

/** 判斷 purpose 是否預期使用區塊格式輸出。 */
const STRUCTURED_PURPOSES = new Set(['ad', 'google_search_ad', 'pmax_ad', 'seo_article'])

export function isStructuredPurpose(purpose: string): boolean {
  return STRUCTURED_PURPOSES.has(purpose)
}
