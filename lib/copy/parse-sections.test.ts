import { describe, it, expect } from 'vitest'
import { parseSections, isStructuredPurpose } from './parse-sections'

// 鎖死 RSA 不分卡修復（commit 7229168）的回歸測試 — parseSections 必須同時吃
// 「標頭與內容同行」與「標頭獨佔一行」兩種格式。
describe('parseSections — 兩種格式皆支援', () => {
  it('同行格式：【Headline 1】內容（RSA 短區塊常見）', () => {
    const text = '【Headline 1】整夜涼感好眠\n【Headline 2】8 折限時下殺'
    const sections = parseSections(text)
    expect(sections).toEqual([
      { title: 'Headline 1', content: '整夜涼感好眠' },
      { title: 'Headline 2', content: '8 折限時下殺' },
    ])
  })

  it('獨佔一行格式：標頭換行接內容', () => {
    const text = '【Headline 1】\n整夜涼感好眠\n\n【Description】\n撐起整夜好眠'
    const sections = parseSections(text)
    expect(sections.map(s => s.title)).toEqual(['Headline 1', 'Description'])
    expect(sections[0].content).toBe('整夜涼感好眠')
  })

  it('多行內容含段落空行要保留（Primary Text）', () => {
    const text = '【Primary Text】\n第一段\n\n第二段\n\n【CTA】\n立即選購'
    const sections = parseSections(text)
    const pt = sections.find(s => s.title === 'Primary Text')
    expect(pt?.content).toBe('第一段\n\n第二段')
  })

  it('沒有任何【】→ 回傳空陣列（退化成純文字）', () => {
    expect(parseSections('這是一段沒有區塊標頭的純文字貼文。')).toEqual([])
  })

  it('空字串 → 空陣列', () => {
    expect(parseSections('')).toEqual([])
  })
})

describe('isStructuredPurpose', () => {
  it('4 個結構化用途為 true', () => {
    for (const p of ['ad', 'google_search_ad', 'pmax_ad', 'seo_article']) {
      expect(isStructuredPurpose(p)).toBe(true)
    }
  })
  it('社群 / 官網用途為 false', () => {
    for (const p of ['post', 'fb_post', 'web_brand', 'web_product']) {
      expect(isStructuredPurpose(p)).toBe(false)
    }
  })
})
