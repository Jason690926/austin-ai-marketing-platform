import { describe, it, expect } from 'vitest'
import { buildPrompt, buildLevel3Prompt } from './scene-templates'
import type { CreativeScale } from '@/types'

const SCALES: CreativeScale[] = ['realistic', 'playful', 'surreal']

function level2Prompt(scale: CreativeScale, ad = { title: '為世足賽喝采加油' }) {
  return buildPrompt({
    mode: 'freeform',
    store: 'bedding',
    freeformDescription: '足球場上',
    stylePreset: 'auto',
    level: 'level2',
    adContent: ad,
    creativeScale: scale,
  })
}

describe('CREATIVE_SCALE_DIRECTION — 三段視覺指令各自注入', () => {
  it('realistic → grounding/接地陰影字樣', () => {
    const p = level2Prompt('realistic')
    expect(p).toMatch(/GROUNDED REALISM/)
    expect(p).toMatch(/contact shadow/i)
    expect(p).toMatch(/never floating/i)
  })

  it('surreal → editorial 超現實:概念/空間 + 光線統一,禁夜市海報語彙', () => {
    const p = level2Prompt('surreal')
    expect(p).toMatch(/EDITORIAL SURREALISM/)
    expect(p).toMatch(/internally consistent light/i)
    expect(p).toMatch(/cohesive/i)
    // 必須明確排除「貼到不相干背景」的爛拼貼
    expect(p).toMatch(/clumsily pasted/i)
    // 新不變式:明文禁「放射爆裂光 / 光暈 / 撞色 / stock 擺拍」這些把超現實做成促銷海報的元素
    expect(p).toMatch(/sunburst/i)
    expect(p).toMatch(/halo/i)
    expect(p).toMatch(/CONCEPT and SPACE/)
  })

  it('playful → 一個巧思 + 維持真實物理', () => {
    const p = level2Prompt('playful')
    expect(p).toMatch(/PLAYFUL CRAFT/)
    expect(p).toMatch(/unified lighting/i)
  })
})

describe('文字紅線 — 跨所有創意尺度恆禁事實型文字（最重要的安全不變式）', () => {
  it('realistic / playful / surreal 三種,Level 2 文字區塊都禁價格/數字/認證/背書/療效', () => {
    for (const scale of SCALES) {
      const p = level2Prompt(scale)
      expect(p, scale).toMatch(/TEXT RED LINE/)
      expect(p, scale).toMatch(/no prices/i)
      expect(p, scale).toMatch(/no certifications/i)
      expect(p, scale).toMatch(/no endorsements/i)
      expect(p, scale).toMatch(/efficacy/i)
    }
  })
})

describe('文字自由度 — 只有 playful/surreal 放寬', () => {
  it('realistic 維持「只用 user 的字」、不放寬', () => {
    const p = level2Prompt('realistic')
    expect(p).toMatch(/render ONLY the exact text/i)
    expect(p).not.toMatch(/MAY add a small amount of non-claim/i)
  })

  it('playful / surreal 允許補非宣稱氛圍字', () => {
    for (const scale of ['playful', 'surreal'] as CreativeScale[]) {
      expect(level2Prompt(scale)).toMatch(/MAY add a small amount of non-claim/i)
    }
  })
})

describe('留白編排自動化 — 文字稀疏時切極簡版面', () => {
  it('只有標題 → minimalist editorial layout', () => {
    expect(level2Prompt('realistic', { title: '為世足賽喝采加油' })).toMatch(/MINIMALIST EDITORIAL LAYOUT/)
  })

  it('文字充足(含副標+賣點)→ 走 hierarchical、不觸發 minimalist', () => {
    const p = buildPrompt({
      mode: 'freeform',
      store: 'bedding',
      freeformDescription: '足球場上',
      stylePreset: 'auto',
      level: 'level2',
      adContent: {
        title: '為世足賽喝采加油',
        subtitle: '涼感升級',
        features: [{ title: '親膚棉柔' }],
      },
      creativeScale: 'realistic',
    })
    expect(p).toMatch(/hierarchical/i)
    expect(p).not.toMatch(/MINIMALIST EDITORIAL LAYOUT/)
  })
})

describe('Level 1 / Level 3 也吃創意尺度', () => {
  it('Level 1 注入創意尺度但無文字區塊', () => {
    const p = buildPrompt({
      mode: 'freeform',
      store: 'bedding',
      freeformDescription: '足球場上',
      stylePreset: 'auto',
      level: 'level1',
      creativeScale: 'surreal',
    })
    expect(p).toMatch(/EDITORIAL SURREALISM/)
    expect(p).not.toMatch(/RENDER THE FOLLOWING TEXT/)
  })

  it('Level 3 注入創意尺度視覺指令', () => {
    const p = buildLevel3Prompt({
      brief: 'SNOOPY 涼被',
      store: 'bedding',
      variation: { kind: 'catalog', index: 1 },
      hasProductImage: true,
      creativeScale: 'surreal',
    })
    expect(p).toMatch(/EDITORIAL SURREALISM/)
  })
})

describe('朝「不鎖死」走 — 大膽模式把環境視為可重構,寫實維持只重生背景', () => {
  function level3WithProduct(scale: CreativeScale) {
    return buildLevel3Prompt({
      brief: 'SNOOPY 涼被',
      store: 'bedding',
      variation: { kind: 'lifestyle', index: 1 },
      hasProductImage: true,
      creativeScale: scale,
    })
  }

  it('realistic:商品圖只重生背景、不重構場景', () => {
    const p = level3WithProduct('realistic')
    expect(p).toMatch(/generate a new background.*AROUND the unchanged product/i)
    expect(p).not.toMatch(/FULLY RE-STAGEABLE/)
  })

  it('playful / surreal:商品本身仍 pixel-faithful,但周遭環境可完全重構', () => {
    for (const scale of ['playful', 'surreal'] as CreativeScale[]) {
      const p = level3WithProduct(scale)
      expect(p, scale).toMatch(/FULLY RE-STAGEABLE/)
      expect(p, scale).toMatch(/ONLY the product itself is fixed/)
      // 商品本身的鐵律不可鬆 — pixel-faithful 仍在
      expect(p, scale).toMatch(/pixel-faithful/)
    }
  })
})

describe('大膽模式鬆綁品牌美學鎖定（讓三段真的拉開差異）', () => {
  it('playful / surreal 注入 CREATIVE OVERRIDE,鬆綁 muted/quiet 鉗制', () => {
    for (const scale of ['playful', 'surreal'] as CreativeScale[]) {
      const p = level2Prompt(scale)
      expect(p, scale).toMatch(/CREATIVE OVERRIDE/)
      expect(p, scale).toMatch(/Disregard any earlier instruction to stay strictly muted/i)
    }
  })

  it('realistic 不鬆綁,維持完整品牌 quality failsafe(含禁高彩度)', () => {
    const p = level2Prompt('realistic')
    expect(p).not.toMatch(/CREATIVE OVERRIDE/)
    expect(p).toMatch(/oversaturated colors/i) // 來自完整 QUALITY_FAILSAFE
  })

  it('大膽模式的 negative prompt 放掉「no over-saturation」', () => {
    expect(level2Prompt('realistic')).toMatch(/no over-saturation/i)
    expect(level2Prompt('surreal')).not.toMatch(/no over-saturation/i)
  })

  it('surreal 指令含具體變數(非抽象品質詞)', () => {
    const p = level2Prompt('surreal')
    expect(p).toMatch(/worm's-eye|bird's-eye|dutch tilt/i) // 具體相機角度
    expect(p).toMatch(/saturated/i)                         // 具體彩度
  })
})

describe('預設 realistic（未指定時向下相容）', () => {
  it('不傳 creativeScale → 預設走 realistic grounding', () => {
    const p = buildPrompt({
      mode: 'freeform',
      store: 'bedding',
      freeformDescription: '臥室',
      stylePreset: 'auto',
      level: 'level1',
    })
    expect(p).toMatch(/GROUNDED REALISM/)
  })
})
