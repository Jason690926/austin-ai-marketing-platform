// 全年行銷檔期資料（品牌電商年度檔期活動）
// 分三層：holiday 節日 / department 百貨檔期 / season 季節主題
// 文案產生時，使用者多選的 campaign 會把 brief 拼進 prompt。

export type CampaignCategory = 'holiday' | 'department' | 'season'

export interface Campaign {
  id: string                  // 穩定 slug，存進 prompt
  label: string               // UI 顯示名
  months: number[]            // 主要適用月份（1–12）
  category: CampaignCategory
  brief: string               // 一句話描述，給 LLM 參考
}

export const CAMPAIGNS: Campaign[] = [
  // ── 1–2 月 ──
  { id: 'new_year',        label: '元旦',           months: [1],     category: 'holiday',    brief: '新年第一天，訴求煥然一新、舒適起始、立新計畫' },
  { id: 'lunar_new_year',  label: '農曆春節',       months: [1, 2],  category: 'holiday',    brief: '農曆新年大掃除換新被、添新枕、迎春團圓，紅色喜氣' },
  { id: 'lny_sale',        label: '春節過年檔',     months: [1, 2],  category: 'department', brief: '百貨春節檔期，年節送禮、家用換新' },
  { id: 'valentine_west',  label: '西洋情人節',     months: [2],     category: 'holiday',    brief: '2/14 情人節，雙人寢具、浪漫送禮' },

  // ── 3–4 月 ──
  { id: 'march_restyle',   label: '三月小改裝',     months: [3],     category: 'department', brief: '百貨春季小改裝檔期，新品鋪貨、櫃位煥新' },
  { id: 'ss_launch',       label: '春夏新品上市',   months: [3, 4],  category: 'season',     brief: '涼感、輕薄、透氣寢具新品推廣' },
  { id: 'qingming',        label: '清明節',         months: [4],     category: 'holiday',    brief: '清明連假返鄉，休息品質、家庭時光' },
  { id: 'children_day',    label: '兒童節',         months: [4],     category: 'holiday',    brief: '兒童寢具、卡通聯名（Snoopy / Classic Teddy）、童趣' },
  { id: 'plum_rain',       label: '梅雨季',         months: [4, 5],  category: 'season',     brief: '潮濕多雨季，抗螨、抗菌、防潮、清爽訴求' },

  // ── 5–6 月 ──
  { id: 'mothers_day',     label: '母親節',         months: [5],     category: 'holiday',    brief: '送媽媽禮，品質、舒適、孝親、感恩' },
  { id: 'mothers_day_sale',label: '母親節換季出清', months: [5],     category: 'department', brief: '百貨母親節檔 + 春夏換季出清雙鉤子' },
  { id: 'dragon_boat',     label: '端午節',         months: [5, 6],  category: 'holiday',    brief: '端午連假、家庭時光、抗潮抗螨' },
  { id: 'shopping_618',    label: '618 購物節',     months: [5, 6],  category: 'department', brief: '電商年中大促，折扣鉤子、限時優惠、CP 值' },
  { id: 'h1_small_lucky',  label: '上半年小確幸',   months: [5, 6],  category: 'department', brief: '百貨上半年小確幸促銷，輕巧入手、無壓消費' },

  // ── 7–8 月 ──
  { id: 'summer_qixi',     label: '暑假 / 七夕檔',  months: [7, 8],  category: 'department', brief: '百貨暑假 + 七夕雙檔期，年輕族群、學生、情侶' },
  { id: 'fathers_day',     label: '父親節',         months: [8],     category: 'holiday',    brief: '送爸爸，腰背支撐、獨立筒床墊、品質感、感謝' },
  { id: 'qixi',            label: '七夕情人節',     months: [8],     category: 'holiday',    brief: '農曆七夕（陽曆 8 月），情侶送禮、雙人寢具' },
  { id: 'ghost_month',     label: '中元普渡',       months: [8],     category: 'holiday',    brief: '中元普渡、家庭祈福，慎用、語氣莊重' },

  // ── 9–10 月 ──
  { id: 'september_restyle',label: '九月小改裝',    months: [9],     category: 'department', brief: '百貨秋季小改裝、櫃位重整' },
  { id: 'mid_autumn',      label: '中秋節',         months: [9],     category: 'holiday',    brief: '中秋團圓返鄉、家庭聚餐、賞月舒眠' },
  { id: 'aw_launch',       label: '秋冬新品上市',   months: [9, 10, 11], category: 'season', brief: '保暖、絨毯、厚被、暖感寢具新品推廣' },
  { id: 'season_switch',   label: '季節交替換季出清', months: [9, 10], category: 'season',   brief: '夏轉秋換季出清，清庫存折扣' },
  { id: 'halloween',       label: '萬聖節',         months: [10],    category: 'holiday',    brief: '年輕族群、趣味、聯名、IG 視覺感' },

  // ── 11–12 月 ──
  { id: 'anniversary',     label: '百貨週年慶',     months: [10, 11], category: 'department',brief: '百貨年度最大檔期，折扣戰、滿額禮、信用卡優惠（百貨主戰場）' },
  { id: 'singles_11_11',   label: '雙 11',          months: [11],    category: 'department', brief: '電商最大促銷，刺激轉換、限時優惠、清楚折扣' },
  { id: 'singles_12_12',   label: '雙 12',          months: [12],    category: 'department', brief: '雙 12 電商尾盤大促' },
  { id: 'christmas',       label: '聖誕節',         months: [12],    category: 'holiday',    brief: '聖誕送禮、家庭溫馨、Snoopy / Teddy 聯名、節慶氛圍' },
  { id: 'year_end',        label: '跨年 / 年末出清', months: [12, 1], category: 'season',    brief: '跨年儀式感、年末出清、迎接新年' },
]

const CATEGORY_LABEL: Record<CampaignCategory, string> = {
  holiday: '節日',
  department: '百貨檔期',
  season: '季節主題',
}

export function getCampaignById(id: string): Campaign | undefined {
  return CAMPAIGNS.find(c => c.id === id)
}

export function categoryLabel(c: CampaignCategory): string {
  return CATEGORY_LABEL[c]
}

/**
 * 依當前月份智能排序：
 *   優先 = 包含當月的 campaign（最相關）
 *   次之 = 包含下個月的 campaign（提早佈局）
 *   再次 = 其他依月份順序
 */
export function sortCampaignsByRelevance(currentMonth: number): Campaign[] {
  const next = currentMonth === 12 ? 1 : currentMonth + 1
  const score = (c: Campaign): number => {
    if (c.months.includes(currentMonth)) return 0
    if (c.months.includes(next)) return 1
    return 2 + Math.min(...c.months.map(m => {
      // 計算離當月的「順時針距離」
      const diff = (m - currentMonth + 12) % 12
      return diff === 0 ? 0 : diff
    }))
  }
  return [...CAMPAIGNS].sort((a, b) => {
    const sa = score(a), sb = score(b)
    if (sa !== sb) return sa - sb
    // 同分時：節日 > 百貨 > 季節，再按月份
    const catRank: Record<CampaignCategory, number> = { holiday: 0, department: 1, season: 2 }
    if (catRank[a.category] !== catRank[b.category]) return catRank[a.category] - catRank[b.category]
    return Math.min(...a.months) - Math.min(...b.months)
  })
}

export function isCurrentOrUpcoming(c: Campaign, currentMonth: number): boolean {
  const next = currentMonth === 12 ? 1 : currentMonth + 1
  return c.months.includes(currentMonth) || c.months.includes(next)
}
