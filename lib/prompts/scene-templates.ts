import type { AssetStore, SceneTemplate, StylePreset } from '@/types'
import { NEGATIVE_PROMPT } from './brand-knowledge'

const PRODUCT_PLACEHOLDER = '{{PRODUCT}}'

const PRODUCT_BY_STORE: Record<AssetStore, string> = {
  mattress: 'Sleeptrain premium mattress',
  bedding: 'AUSTIN HOME bedding set (pillows, duvet, fitted sheet)',
}

function renderProduct(template: string, store: AssetStore): string {
  return template.split(PRODUCT_PLACEHOLDER).join(PRODUCT_BY_STORE[store])
}

export const SCENE_TEMPLATES: SceneTemplate[] = [
  {
    id: 'hotel_suite',
    name: '五星飯店套房',
    description: '高端暗色調，奢華皇室感',
    promptBody: `A luxury 5-star hotel suite bedroom. The ${PRODUCT_PLACEHOLDER} is the centerpiece on a premium bed frame. Warm amber lighting from wall sconces and a chandelier. Deep walnut wood furniture, gold accents, heavy curtains half-drawn revealing city lights. Dark rich tones — deep brown, champagne gold. Shot at 30-degree side angle. Real photography feel, not 3D render.`,
  },
  {
    id: 'cozy_family',
    name: '溫馨家庭臥室',
    description: '明亮暖色調，新婚夫妻首選清晨感',
    promptBody: `A cozy family master bedroom bathed in soft morning sunlight through sheer curtains. The ${PRODUCT_PLACEHOLDER} on a light oak bed frame. Linen bedding in cream and dusty rose. Small bedside plants, books, a warm table lamp. Bright warm tones — off-white, light wood, blush. Wide shot showing the full room. Real photography feel.`,
  },
  {
    id: 'japanese_minimal',
    name: '日式簡約禪意',
    description: '柔和中性調，清雅無印風',
    promptBody: `A minimalist Japanese-inspired bedroom. The ${PRODUCT_PLACEHOLDER} on a low platform bed frame. Neutral palette — light gray, natural linen, pale oak wood. A single ikebana arrangement on the bedside. Diffused natural light, no harsh shadows. Clean lines, negative space. Shot from slightly elevated angle. Muted, serene atmosphere. Real photography feel.`,
  },
  {
    id: 'outdoor_nature',
    name: '戶外自然草地',
    description: '清新明亮，夏日戶外活力感',
    promptBody: `The ${PRODUCT_PLACEHOLDER} placed outdoors on lush green grass under bright sunlight. Blue sky with light clouds in background. White linen bedding billowing softly. Fresh outdoor ambiance — greens, sky blues, warm sunlight. Low camera angle looking slightly upward. Bright and airy. Real outdoor photography feel, sharp natural light.`,
  },
  {
    id: 'studio_product',
    name: '棚拍商品圖',
    description: '純白背景，專業電商主圖用',
    promptBody: `Professional studio product photography of the ${PRODUCT_PLACEHOLDER}. Pure white or very light gray seamless background. Even diffused soft-box lighting from both sides, no harsh shadows. Fabric texture and quilting detail clearly visible. Front-facing or slight 3/4 angle. Clean, clinical, e-commerce ready. Real photography feel.`,
  },
]

const STYLE_MODIFIERS: Record<StylePreset, string> = {
  hotel_dark: 'Dark, moody, luxurious atmosphere. Deep warm tones, dramatic lighting.',
  cozy_warm: 'Warm, bright, inviting. Soft natural light, cream and wood tones.',
  minimal_clean: 'Minimal, clean, neutral. Simple composition, muted palette.',
  outdoor_natural: 'Bright, natural, fresh. Outdoor natural sunlight, vivid greens.',
  auto: '',
}

export function buildPrompt({
  mode,
  store,
  sceneTemplate,
  freeformDescription,
  stylePreset,
  additionalNotes,
}: {
  mode: 'scene' | 'reference' | 'freeform'
  store: AssetStore
  sceneTemplate?: SceneTemplate
  freeformDescription?: string
  stylePreset: StylePreset
  additionalNotes?: string
}): string {
  const parts: string[] = []
  const product = PRODUCT_BY_STORE[store]

  if (mode === 'scene' && sceneTemplate) {
    parts.push(renderProduct(sceneTemplate.promptBody, store))
  } else if (mode === 'freeform' && freeformDescription) {
    parts.push(
      `A professional product photograph of a ${product}. Scene: ${freeformDescription}. Real photography feel, not CGI or 3D render.`
    )
  } else if (mode === 'reference') {
    parts.push(
      `A professional product photograph of a ${product}, styled in the same composition and atmosphere as the reference image provided. Maintain the same mood, lighting angle, and color palette, but featuring the ${product} as the hero product. Real photography feel.`
    )
  }

  const styleModifier = STYLE_MODIFIERS[stylePreset]
  if (styleModifier) parts.push(styleModifier)

  if (additionalNotes) parts.push(`Additional requirement: ${additionalNotes}`)

  parts.push('Leave adequate empty space in the composition for text overlay (Level 1 base image mode).')
  parts.push(NEGATIVE_PROMPT)

  return parts.join('\n\n')
}

export function getSceneById(id: string): SceneTemplate | undefined {
  return SCENE_TEMPLATES.find((s) => s.id === id)
}
