import type { AssetStore, SceneTemplate, StylePreset, CreativeScale } from '@/types'
import { NEGATIVE_PROMPT } from './brand-knowledge'

// 品牌專屬 aesthetic anchor — 解決「場景廉價」問題
// 寫成 prose 段落,避免 ===/條列符號被 Gemini 誤判為 function call(MALFORMED_FUNCTION_CALL bug)
const BRAND_AESTHETIC_ANCHORS: Record<AssetStore, string> = {
  bedding: 'Aesthetic anchor for AUSTIN bedding. Reference: Kinfolk magazine editorial, MUJI Hotel interiors, Apartamento magazine, Japanese designer residences (Schemata Architects, Jo Nagasaka). Palette: muted earth tones — oat, ivory, raw cotton, dusty sage, soft terracotta, warm wood; never oversaturated pink, never candy colors. Light: soft overcast natural light filtered through sheer linen curtains, or a single warm ceramic table lamp; directional with intentional shadow; never blown-out windows, never phone-camera HDR, never flat overhead light. Architecture: refined contemporary Japanese-influenced or Nordic-minimalist bedroom with white plaster walls, raw oak beams, low platform beds, a single piece of contemporary art; not generic IKEA-flat apartments. Materials: linen weave, raw cotton, stoneware, ceramics, raw oak, brass — tactile, premium, natural; render fabric weave and fiber detail visibly. Mood: quiet contemplation, domestic warmth, refined solitude; never exuberant, never busy.',
  mattress: 'Aesthetic anchor for Sleeptrain mattress (American-California luxury). Reference: Wallpaper* private residence reviews, Mandarin Oriental and St. Regis hotel suite photography, Architectural Digest American luxury homes, Restoration Hardware catalog. Palette: deep walnut, champagne gold, charcoal, oxblood burgundy, brushed brass; warm sophisticated luxury, not garish. Light: cinematic directional warm tungsten, single key light, deep controlled shadows; never flat HDR, never overexposed. Architecture: 5-star hotel suite or upscale Californian residence with deep walnut headboards, heavy textured drapes, marble or stone surfaces, refined crown molding. Materials: silk, velvet, leather, brushed brass, marble, dark wood — premium, sensual, weighty. Mood: sophisticated, refined, hotel-luxury aspirational; never cheesy newlywed-stock-photo, never candy-colored.',
}

const HUMAN_DIRECTION = 'Human subject direction (mandatory when scene includes people). Pose: candid editorial moment — subjects look at what they are doing (book, mug, window, child), not at camera, not toothy-smiling at each other. Wardrobe: natural-fabric loungewear (linen, fine cotton, cashmere) in muted undyed tones; never cheap polyester, never mass-market apparel with logos. Casting: individual characterful faces with quiet presence; avoid generic stock-photo Asian newlywed couple trope, avoid exuberant happy-family-cereal-ad casting. Interaction: companionable quiet, restraint, genuine stillness; never posed, never tickling or laughing exuberantly. With multiple people, often each looks at their own thing (one reads, one looks out the window) — silent intimacy, not active interaction.'

const INTERIOR_PROP_DIRECTION = 'Interior and prop direction (mandatory). Furniture should be designer-tier with intentional craft (solid wood joinery, ceramic lamps, woven textiles); never IKEA-flat, never mass-furniture-store look. Use a few intentional props (one hardcover book, one stoneware vessel, a single artwork, dried botanicals); not cluttered, not sterile-empty. Backgrounds should show textured lived-in surfaces (plaster, raw wood, linen, stone); never flat painted drywall, never over-styled model-home sterility. Window treatments: linen sheers softening the light; never bright vinyl blinds, never blown-out white. Minimize visible screens or electronics unless editorially intentional.'

const TYPOGRAPHY_DIRECTION = 'Typography direction (mandatory when text is rendered). Use editorial-grade typefaces only — refined serif (e.g. GT Sectra, Plantin) or sophisticated sans (e.g. GT America, Söhne); never system fonts, never Microsoft Word defaults, never Canva-template fonts. Hierarchy: deliberate scale jumps, generous letter-spacing, considered line-breaks. Layout: place text with editorial intention — often top-left, bottom-left, or along a design grid; never centered-floating like an e-commerce sticker, never bottom-right tag style. Quantity: less is more — one headline plus at most one sub-line. Heavy text density instantly cheapens the image. No drop shadows, no outlines, no neon, no gradient text fills.'

const QUALITY_FAILSAFE = 'Quality failsafe — these patterns instantly destroy editorial quality and are forbidden: Canva or PowerPoint or Word template aesthetic; stock-photography happy-family or smiling-couple tropes; cheap clip-art, emoji, generic icons, sticker graphics; cluttered text layouts and templated advertising-poster feel; oversaturated colors, neon gradients, drop-shadow text effects; mass-market furniture (IKEA, Wayfair budget look); blown-out windows, phone-camera HDR, flat overhead lighting; generic model-home sterility or cluttered messiness; toothy fake smiles at camera; polyester loungewear, branded sleepwear, clothing with logos or character prints.'

// 創意尺度視覺指令 — 第三條軸。prose 段落(避免 ===/dash bullets 觸發 MALFORMED_FUNCTION_CALL)。
// realistic 的 grounding 段直接對症「床漂浮在球場、無接地陰影」的拼貼 bug;
// surreal 強調「刻意的好超現實」= 單一概念 + 光線統一,不是把產品貼到不相干背景。
// 指令寫成「具體可畫的變數」(相機角度/光線/彩度/尺度),而非抽象品質詞 —
// 否則 Gemini 把三段收斂成幾乎一樣。playful/surreal 另搭 BOLD override 鬆綁品牌美學鎖定。
const CREATIVE_SCALE_DIRECTION: Record<CreativeScale, string> = {
  realistic:
    'CREATIVE SCALE = GROUNDED REALISM (photoreal, on-brand). Camera: natural eye-level or a gentle editorial angle, like a real interior/product photograph. Composition: the product sits believably on a real surface at true real-world scale; nothing oversized, nothing impossible. Lighting: soft natural directional light with true contact shadows and ambient occlusion consistent with one dominant light source; color temperature, exposure and depth-of-field all match the surrounding scene. Color: restrained, natural, on-brand palette. The result must read as one genuine photograph taken in that place — absolutely never floating, never an obvious cut-and-paste composite, never mismatched lighting between product and background.',
  playful:
    'CREATIVE SCALE = PLAYFUL CRAFT (clearly elevated beyond a plain shot). Keep believable physics, real contact shadows and unified lighting, BUT this image MUST be visibly more designed than a normal product photo — introduce at least ONE bold, concrete twist: a dynamic camera angle (notably low or high, or a slight dutch tilt), one exaggerated prop or playful scale shift, a vivid accent color, or a graphic stylised backdrop. Saturated accent color is allowed. Characterful, art-directed and cohesive — never a plain catalog shot, never a random collage.',
  surreal:
    'CREATIVE SCALE = INTENTIONAL SURREALISM (must look OBVIOUSLY different from a realistic shot). Build a bold, dreamlike, conceptually surreal hero image: use a dramatic NON-eye-level camera (worm\'s-eye, bird\'s-eye, or a strong dutch tilt), theatrical or colored cinematic lighting, deliberate large scale shifts, and an imaginative or impossible environment / staging. Rich saturated, striking color is welcome and encouraged. The product itself stays unchanged, but stage it theatrically (it may float, tower, or sit somewhere impossible). CRITICAL: it must still be ONE cohesive image with a single clear concept and internally consistent lighting and shadows across every element — the surreal placement is deliberate art direction, so lighting, shadow, scale and perspective stay unified and intentional. It must read as a crafted surreal artwork — never as a product clumsily pasted onto an unrelated stock background.',
}

// playful/surreal 用:主動鬆綁品牌 aesthetic anchor 的「muted/quiet/never-exuberant」鉗制,
// 否則安靜低彩度的品牌鐵律會把大膽模式拉回跟寫實一樣。仍保留「不可廉價」的底線。
const BOLD_SCALE_AESTHETIC_OVERRIDE =
  'CREATIVE OVERRIDE (this image uses a BOLD creative scale): you may deliberately depart from the muted, quiet, restrained brand palette and mood described above. Vivid saturated color, dramatic theatrical or colored lighting, exuberant dynamic composition, and surreal scale/staging are ENCOURAGED. Disregard any earlier instruction to stay muted, quiet, low-saturation, never-exuberant or never-busy. (Still avoid genuinely CHEAP execution: no Canva/PowerPoint template look, no clip-art or sticker graphics, no amateur graphic design, no phone-camera HDR.)'

// 大膽模式用的較輕 quality failsafe:保留「不可廉價」,但放掉「禁高彩度/戲劇性」這些壓制大膽的條款。
const QUALITY_FAILSAFE_BOLD =
  'Quality failsafe (bold creative scale) — these still look cheap and remain forbidden: Canva or PowerPoint or Word template aesthetic; clip-art, generic icons, sticker graphics; amateur templated advertising-poster layout; mass-market IKEA furniture; phone-camera HDR or accidental flat overhead lighting; toothy fake stock-photo smiles. Saturated color, dramatic/colored/theatrical lighting, bold scale and surreal staging are ALLOWED and encouraged at this scale.'

// 文字紅線 — 跨所有創意尺度恆禁 AI 自生「事實型文字」(合規)。playful/surreal 放寬的只是「非宣稱氛圍字」。
const TEXT_FACT_REDLINE =
  'ABSOLUTE TEXT RED LINE (never violate, any creative scale): do NOT invent or render any factual claim text that was not provided — no prices, no numbers, no percentages, no specs, no certifications, no endorsements, no awards, no store counts, no medical or efficacy claims. Inventing such text is false advertising.'

// 依創意尺度回傳 Level 2 的文字自由度規則。realistic 嚴格只用 user 的字;playful/surreal 允許非宣稱氛圍字。
function buildTextLibertyRules(scale: CreativeScale): string[] {
  if (scale === 'realistic') {
    return [
      '- No invented text — render ONLY the exact text provided above. Do NOT add slogans, decorative labels, watermarks, or brand stamps not in the list.',
      `- ${TEXT_FACT_REDLINE}`,
    ]
  }
  // playful / surreal
  return [
    '- You MAY add a small amount of non-claim mood/atmosphere wording or decorative typographic accents that fit the creative concept (e.g. a short evocative phrase, a season word), in addition to the provided text — keep it tasteful and sparse, never cluttered.',
    `- ${TEXT_FACT_REDLINE}`,
  ]
}

function buildAestheticDirection(store: AssetStore, includeHumans: boolean, scale: CreativeScale = 'realistic'): string {
  const bold = scale !== 'realistic'
  const parts = [BRAND_AESTHETIC_ANCHORS[store]]
  if (includeHumans) parts.push(HUMAN_DIRECTION)
  parts.push(INTERIOR_PROP_DIRECTION)
  parts.push(TYPOGRAPHY_DIRECTION)
  // 大膽模式:換較輕的 failsafe + 加 override 鬆綁品牌美學鉗制;寫實模式:維持完整品牌鐵律。
  if (bold) {
    parts.push(QUALITY_FAILSAFE_BOLD)
    parts.push(BOLD_SCALE_AESTHETIC_OVERRIDE)
  } else {
    parts.push(QUALITY_FAILSAFE)
  }
  return parts.join('\n\n')
}

// Level 2 用的 negative prompt:允許文字(因為要燒字),但其他禁制照常
const LEVEL_2_NEGATIVE_PROMPT = [
  'No people (unless explicitly in scene direction), no plastic 3D render style, no artificial HDR, no over-saturation, no cartoon style, no watermarks, no fake brand logos beyond what is explicitly listed in the text rendering block.',
  'NO Canva-template look, NO PowerPoint slide design, NO amateur graphic design, NO clip-art, NO stock-photo aesthetic, NO templated "advertising poster" feel.',
].join(' ')

// 大膽模式(playful/surreal)用的 negative prompt:拿掉「no over-saturation」(那會壓制大膽彩度),
// 仍保留「不可廉價」(Canva/clip-art/amateur)底線。
const LEVEL_2_NEGATIVE_PROMPT_BOLD = [
  'No watermarks, no fake brand logos beyond what is explicitly listed in the text rendering block.',
  'NO Canva-template look, NO PowerPoint slide design, NO amateur graphic design, NO clip-art, NO sticker graphics. (Saturated color and dramatic lighting are allowed at this creative scale.)',
].join(' ')

// 依創意尺度挑 Level 2/3 的 negative prompt。
function level2NegativeForScale(scale: CreativeScale): string {
  return scale === 'realistic' ? LEVEL_2_NEGATIVE_PROMPT : LEVEL_2_NEGATIVE_PROMPT_BOLD
}

// 比例 outpaint 提示 — ref 是某比例、輸出是另一比例時用
function buildOutpaintNote(refRatio: string, outputRatio: string): string {
  return [
    `ASPECT RATIO ADAPTATION (mandatory):`,
    `The visual reference image is ${refRatio}; the output target aspect ratio is ${outputRatio}.`,
    `EXTEND the scene horizontally/vertically as needed to fill the new aspect ratio. Preserve the central composition and subject exactly; intelligently extend the background/environment/scene to the sides (or top/bottom) as if the photograph had originally been shot with the wider/taller framing.`,
    `The extended areas must look like a natural, organic continuation of the reference scene — same lighting direction, same materials/textures, same atmosphere, same depth-of-field — NOT a stretched, padded, or letterboxed version.`,
    `Do NOT crop the central subject. Do NOT distort or stretch the original. Do NOT add black bars, blur edges, or visible seams between original and extended regions.`,
  ].join('\n')
}

const PRODUCT_PLACEHOLDER = '{{PRODUCT}}'

const PRODUCT_BY_STORE: Record<AssetStore, string> = {
  mattress: 'Sleeptrain premium mattress',
  bedding: 'AUSTIN bedding set (pillows, duvet, fitted sheet)',
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

// Level 2 完整廣告:模型直接把文字燒進圖
// 兩種輸入模式:
//   1. structured — 使用者填好每個字,model 只渲染(忠實呈現 approved copy)
//   2. concept    — 使用者只給活動意圖+賣點,model 自己決定 headline/排版/字級(海報概念)
export interface AdContent {
  title: string                                          // 主標題(必填)
  subtitle?: string                                      // 副標題(選填)
  endorsement?: string                                   // 背書標語(選填)
  features?: Array<{ title: string; subtitle?: string }> // 產品賣點(最多 3)
}

export interface AdConceptBrief {
  campaign: string    // 活動意圖,如「母親節促銷」「新品上市」(必填)
  features: string[]  // 賣點清單,model 自己挑最有感的 1-2 點寫 headline
}

export type AdMode = 'structured' | 'concept'

// Level 3:AI 全權自主 — 給商品 brief,AI 自己想場景/寫文案/設計版面
export type Level3VariationKind = 'catalog' | 'lifestyle'
export interface Level3Variation {
  kind: Level3VariationKind
  sceneHint?: string  // 給 model 的場景方向(由後端從 LIFESTYLE_ARCHETYPES 帶入)
  index: number       // 變體編號(1-base)
}

// 人物情境變體池 — 品牌專屬,內嵌 editorial 具體規格(燈光/道具/wardrobe/視線/建築)
const LIFESTYLE_ARCHETYPES_BY_STORE: Record<AssetStore, string[]> = {
  bedding: [
    'Kinfolk-magazine editorial: a single woman in her late 20s sitting up on a low platform bed reading a hardcover book, looking DOWN at the page (NOT at camera). Wearing oat linen loungewear. Soft overcast 9am light through sheer linen curtains. Bedroom: white plaster walls, raw oak headboard, single contemporary art print, stoneware vase with one dried branch on bedside. Palette: oat / ivory / dusty terracotta. Mood: quiet contemplation.',
    'MUJI-Hotel editorial: a quiet couple in their early 30s reading SEPARATELY in bed — one with a hardcover book, one writing in a notebook. Both look at their OWN materials, NOT at each other, NOT at camera, NOT smiling. Wardrobe: fine undyed cotton sleepwear. Bedroom: raw oak headboard, ceramic table lamp casting singular warm light, white plaster walls, single ikebana on bedside. Companionable-silence vibe.',
    'Casa BRUTUS lifestyle: a mother in her early 30s reading a Japanese hardcover picture book to her toddler on a tatami-style low platform bed. Both look DOWN at the book, not at camera. Soft north-facing window light through linen curtain. Bedroom: minimalist warm-wood, single piece of children-friendly contemporary art, plaster walls. Palette: warm oak / ivory / soft sage. Tender but completely UNposed.',
    'Apartamento magazine editorial: a man in his mid-30s sitting up in bed drinking single-origin coffee from a stoneware mug, an open notebook in his lap, gentle 7am morning light filtered through linen curtains. Bedroom is a designer\'s personal space: vintage walnut bedside table, single ceramic floor lamp, leather-bound books, single dried eucalyptus stem in a stoneware vessel. He looks at the notebook, NOT at camera.',
    'Quiet weekend afternoon editorial: a stylish woman in her late 20s on the bed with a wooden tea tray — ceramic teapot, single cup, an open hardcover book. Soft 3pm warm window light. Bedroom: plaster walls, single piece of contemporary monochrome art, ceramic floor vase with eucalyptus stems. She looks OUT the window, NOT at camera. Refined solitude.',
    'Kinfolk family Sunday morning: parents and one child in bed but the moment is QUIET and STILL (NOT exuberant, NOT tickling, NOT laughing). One parent reads to the child, the other parent looks out the window with a coffee mug. Soft morning light. Refined wooden architecture, sheer linen curtains. Wardrobe: natural-fabric loungewear in undyed tones, no logos, no character prints.',
  ],
  mattress: [
    'Wallpaper* hotel-review editorial: a woman in her 30s reading a hardcover book in a 5-star hotel-suite bed, wearing silk pajamas in champagne, ONE warm tungsten reading lamp on the walnut bedside, the rest of the suite in soft moody shadow. Deep walnut headboard, champagne velvet curtains half-drawn. She looks at the book, NOT at camera. Mandarin Oriental aesthetic, sophisticated solo evening.',
    'St. Regis residential editorial: a refined couple in their early 40s in a luxury hotel-style bedroom in the evening — wearing tailored silk robes, ONE holding a leather-bound book, the OTHER pouring whisky from a crystal decanter. NOT looking at each other, NOT at camera. Deep walnut and brushed brass interior, warm directional tungsten lighting, marble bedside surface. Architectural Digest level.',
    'Architectural Digest morning: a sophisticated single man in his late 30s in a Californian luxury residence bedroom, sitting at the edge of a walnut platform bed, lacing leather oxfords. Floor-to-ceiling windows reveal soft Californian morning fog. Wardrobe: charcoal cashmere. Single brass lamp, marble bedside, hardcover architecture book. He looks DOWN at his task, NOT at camera.',
    'Restoration Hardware catalog editorial: a stylish woman in her 30s having morning espresso in a luxurious Californian bedroom — wearing oat cashmere robe, holding a porcelain espresso cup. Cinematic warm directional sunrise light through linen drapes. Deep walnut bed frame, marble surfaces, single piece of large-scale contemporary art. She looks OUT the window, NOT at camera.',
    'Cinematic evening editorial: a refined gentleman in his 40s in his luxury bedroom in the evening — pouring a single-malt whisky from a crystal decanter into a tumbler. Single warm tungsten table lamp, the rest of the room in deep moody shadow. Deep walnut, brushed brass, leather, dark wood. He looks at the whisky pour, NOT at camera. Mandarin Oriental Suite vibe.',
    'Architectural Digest family editorial: a refined couple with one teenager in a Californian luxury residence bedroom on a quiet weekend afternoon. Each is doing their OWN thing (book, sketchpad, looking out window). Refined casual wear in undyed natural tones. Walnut, marble, brass interior. Late-afternoon warm directional light. Completely UNposed.',
  ],
}

function buildLevel3CatalogBlock(brief: string, store: AssetStore): string {
  return [
    'You are a SENIOR CREATIVE DIRECTOR designing a high-end product marketing CATALOG page.',
    '',
    'PRODUCT BRIEF (from the client — extract product name, materials, features, target audience, key selling points):',
    brief.trim(),
    '',
    'YOUR CREATIVE TASKS (make all design decisions yourself):',
    '1. Design a premium CATALOG-STYLE marketing image — clean editorial composition, magazine-quality aesthetic',
    '2. WRITE a punchy Traditional Chinese headline (1 line, ≤10 chars) derived from the product name + most compelling selling point',
    '3. WRITE a sub-line (≤18 chars) highlighting key material or feature',
    '4. Optionally add 1 small spec tag (size / material / variant count) if it strengthens the page',
    '5. Choose typography hierarchy and color palette matching the brand and product positioning',
    '6. Photography style: product hero shot on clean styled background, premium studio feel — NO people',
    '7. Render the COMPLETE catalog image with all text overlay integrated',
    '',
    'TEXT RENDERING RULES (mandatory):',
    '- Traditional Chinese only (繁體中文) — render every character exactly, no typos, no simplification',
    `- Typography style: ${BRAND_TYPOGRAPHY[store]}`,
    '- High contrast, clean readability',
    '- Brand cap rules: SNOOPY, PEANUTS, AUSTIN, AZING = ALL CAPS; Sleeptrain capitalized; Classic Teddy as two capitalized words',
    '- DO NOT invent prices, percentages, or specific promotions not in the brief',
    '- Only render text in Traditional Chinese unless brand names',
  ].join('\n')
}

function buildLevel3LifestyleBlock(brief: string, store: AssetStore, variation: Level3Variation): string {
  const pool = LIFESTYLE_ARCHETYPES_BY_STORE[store]
  const sceneHint = variation.sceneHint || pool[(variation.index - 1) % pool.length]
  return [
    'You are a SENIOR CREATIVE DIRECTOR designing a LIFESTYLE scene featuring this product in real-life context.',
    '',
    'PRODUCT BRIEF:',
    brief.trim(),
    '',
    `SCENE DIRECTION (variation ${variation.index} — make this scene visibly different from other variations):`,
    sceneHint,
    '',
    'YOUR CREATIVE TASKS:',
    '1. Design a warm, aspirational LIFESTYLE scene that integrates the product naturally — like a real lifestyle photography shoot',
    '2. Include 1-2 people interacting NATURALLY with the product (sleeping, reading, cuddling, etc.) — they should not look posed',
    '3. Setting, lighting, and mood from the scene direction above',
    '4. Optionally add SMALL discreet text overlay (max headline ≤8 chars + max 1 sub-line ≤15 chars) ONLY if it fits the editorial composition — many lifestyle shots work best with NO text or minimal text',
    '5. If you do add text, write punchy Traditional Chinese derived from the product brief',
    '6. Photography style: real lifestyle photography, soft natural light, warm intimate atmosphere — NOT a posed studio shot',
    '',
    'TEXT RENDERING RULES (if you choose to add text):',
    '- Traditional Chinese only (繁體中文)',
    `- Typography: ${BRAND_TYPOGRAPHY[store]}`,
    '- Small, discreet placement — text serves the scene, scene is NOT the headline',
    '- Brand cap rules: SNOOPY, PEANUTS, AUSTIN, AZING = ALL CAPS',
    '- DO NOT invent prices, percentages, or specific promotions',
  ].join('\n')
}

export function buildLevel3Prompt(opts: {
  brief: string
  store: AssetStore
  variation: Level3Variation
  hasProductImage: boolean
  creativeScale?: CreativeScale
}): string {
  const parts: string[] = []
  const scale: CreativeScale = opts.creativeScale ?? 'realistic'

  // 商品圖優先指令(若有)
  if (opts.hasProductImage) {
    parts.push(
      [
        'CRITICAL PRODUCT INSTRUCTION: The FIRST attached image is THE PRODUCT to use.',
        'The product itself must remain UNCHANGED — preserve its design, materials, color, pattern, fabric texture, branding text/logo, silhouette, and proportions EXACTLY as shown. Do NOT redesign, recolor, or substitute the product.',
        'Your job is to generate the scene/background/composition AROUND the unchanged product per the creative direction below.',
      ].join('\n'),
    )
  }

  // 創意尺度視覺指令(提前 inject,優先吸收)
  parts.push(CREATIVE_SCALE_DIRECTION[scale])

  // 品牌 aesthetic anchor 提前 inject(模型優先吸收)
  // catalog 無人,lifestyle 有人 → human direction 只在 lifestyle 加
  parts.push(buildAestheticDirection(opts.store, opts.variation.kind === 'lifestyle', scale))

  if (opts.variation.kind === 'catalog') {
    parts.push(buildLevel3CatalogBlock(opts.brief, opts.store))
  } else {
    parts.push(buildLevel3LifestyleBlock(opts.brief, opts.store, opts.variation))
  }

  // Level 3 negative prompt 依創意尺度(大膽模式放寬彩度)
  parts.push(level2NegativeForScale(scale))
  return parts.join('\n\n')
}

export function planLevel3Variations(catalogCount: number, lifestyleCount: number, store: AssetStore): Level3Variation[] {
  const out: Level3Variation[] = []
  const pool = LIFESTYLE_ARCHETYPES_BY_STORE[store]
  let idx = 1
  for (let i = 0; i < catalogCount; i++) {
    out.push({ kind: 'catalog', index: idx++ })
  }
  for (let i = 0; i < lifestyleCount; i++) {
    out.push({
      kind: 'lifestyle',
      sceneHint: pool[i % pool.length],
      index: idx++,
    })
  }
  return out
}

const BRAND_TYPOGRAPHY: Record<AssetStore, string> = {
  mattress: 'modern luxury typography with serif headlines (Sleeptrain brand — premium American mattress positioning, suggests upscale hotel signage)',
  bedding: 'warm modern sans-serif typography with friendly approachable feel (AUSTIN brand — Taiwanese home bedding, lifestyle warmth)',
}

function buildTextRenderingBlock(ad: AdContent, store: AssetStore, scale: CreativeScale): string {
  const lines: string[] = []
  lines.push('RENDER THE FOLLOWING TEXT DIRECTLY ONTO THE IMAGE as part of the composition (this is a complete advertisement, not a base image):')
  lines.push('')
  lines.push(`- MAIN HEADLINE (largest, most prominent): 「${ad.title}」`)
  if (ad.subtitle?.trim()) {
    lines.push(`- SUBTITLE (under headline, medium size): 「${ad.subtitle.trim()}」`)
  }
  if (ad.endorsement?.trim()) {
    lines.push(`- ENDORSEMENT TAGLINE (small, top corner or near bottom): 「${ad.endorsement.trim()}」`)
  }
  const features = (ad.features || []).filter(f => f.title?.trim())
  if (features.length > 0) {
    lines.push(`- PRODUCT FEATURES (compact bullet list, ${features.length} items):`)
    for (const f of features) {
      const subPart = f.subtitle?.trim() ? `: ${f.subtitle.trim()}` : ''
      lines.push(`  • ${f.title.trim()}${subPart}`)
    }
  }
  // 留白編排自動化:文字填得少(只有標題)→ 切極簡 editorial 版面,讓「少」變「精」,不靠捏字填版。
  const sparse = !ad.subtitle?.trim() && !ad.endorsement?.trim() && features.length === 0
  lines.push('')
  lines.push('TEXT RENDERING RULES (mandatory):')
  lines.push('- Language: Traditional Chinese characters (繁體中文) — render every character exactly as written above, no substitutions, no typos, no simplification, no transliteration.')
  lines.push(`- Typography style: ${BRAND_TYPOGRAPHY[store]}.`)
  if (sparse) {
    lines.push('- MINIMALIST EDITORIAL LAYOUT (few words provided): embrace generous negative space with one strong, beautifully set headline as the focal point — make sparse text look intentional and premium (like a high-end editorial ad), do NOT fill the empty space with invented copy.')
  } else {
    lines.push('- Layout: hierarchical — headline largest and most eye-catching, subtitle smaller below, features as compact list, endorsement small and discreet. Group related elements together; do not scatter text randomly.')
  }
  lines.push('- Contrast: ensure all text is highly readable against its background (use white/light text on dark areas, or dark/black text on light areas; add subtle drop shadow or semi-transparent backing if needed for legibility).')
  lines.push('- Placement: place text in clean composition zones that do not cover the hero product. Headlines often work in upper-third or lower-third of frame.')
  lines.push('- Brand name capitalization (when text contains brand names): SNOOPY, PEANUTS, AUSTIN, AZING must be ALL CAPS; Sleeptrain capitalized as "Sleeptrain"; Classic Teddy as two capitalized words.')
  // 文字自由度依創意尺度;紅線(禁事實型文字)跨所有模式恆禁。
  for (const rule of buildTextLibertyRules(scale)) lines.push(rule)
  return lines.join('\n')
}

export function buildPrompt({
  mode,
  store,
  sceneTemplate,
  freeformDescription,
  stylePreset,
  creativeScale,
  additionalNotes,
  hasProductImage,
  hasReferenceImage,
  level,
  adContent,
  refRatio,
  outputRatio,
}: {
  mode: 'scene' | 'reference' | 'freeform'
  store: AssetStore
  sceneTemplate?: SceneTemplate
  freeformDescription?: string
  stylePreset: StylePreset
  creativeScale?: CreativeScale   // 創意尺度:寫實/巧思/超現實(預設 realistic)
  additionalNotes?: string
  hasProductImage?: boolean       // 是否上傳商品圖(model 的第 1 張參考圖)
  hasReferenceImage?: boolean     // 是否上傳場景/風格參考圖(reference mode 才有,model 的第 2 張)
  level?: 'level1' | 'level2'     // level2 = 完整廣告(模型把文字燒進圖)
  adContent?: AdContent           // level2 才需要
  refRatio?: string               // 參考圖實際比例字串(如 "1:1")— 用來偵測是否需要 outpaint
  outputRatio?: string            // 本次輸出比例字串(如 "16:9")
}): string {
  const scale: CreativeScale = creativeScale ?? 'realistic'
  const parts: string[] = []
  const product = PRODUCT_BY_STORE[store]

  // 若有商品圖,先給最高優先指令:必須照搬商品圖的商品(商品本身不變,只重生背景/氛圍)
  if (hasProductImage) {
    const imageRoleNote = hasReferenceImage
      ? 'The FIRST attached image is THE PRODUCT to use. The SECOND attached image is a visual reference for style, composition, and atmosphere only — do not copy its product if any.'
      : 'The FIRST attached image is THE PRODUCT to use.'
    parts.push(
      [
        `CRITICAL PRODUCT INSTRUCTION: ${imageRoleNote}`,
        `The product itself must remain UNCHANGED — preserve its design, materials, color, pattern, fabric texture, branding text/logo, silhouette, and proportions EXACTLY as shown in the product image, pixel-faithful to the original product. Do NOT redesign, recolor, restyle, or substitute the product.`,
        `Your job is ONLY to generate a new background, environment, lighting, and atmosphere AROUND the unchanged product, integrating it naturally into the scene described below. Treat this like compositing the original product onto a freshly painted scene — the product is the constant, the scene is the variable.`,
      ].join('\n')
    )
  }

  // 主場景描述(若有商品圖,把 generic product 描述換成「the product from the reference」)
  const productPhrase = hasProductImage
    ? 'the product shown in the product image'
    : `a ${product}`

  if (mode === 'scene' && sceneTemplate) {
    if (hasProductImage) {
      // 場景模板的 promptBody 含 {{PRODUCT}} 佔位符,當有商品圖時替換為「product image 中的商品」
      const sceneBody = sceneTemplate.promptBody.split(PRODUCT_PLACEHOLDER).join('product shown in the product image')
      parts.push(sceneBody)
    } else {
      parts.push(renderProduct(sceneTemplate.promptBody, store))
    }
  } else if (mode === 'freeform' && freeformDescription) {
    parts.push(
      `A professional product photograph of ${productPhrase}. Scene: ${freeformDescription}. Real photography feel, not CGI or 3D render.`
    )
  } else if (mode === 'reference') {
    parts.push(
      [
        `A professional product photograph of ${productPhrase}.`,
        '',
        'REFERENCE IMAGE FIDELITY (mandatory — this is the most important rule for this image):',
        'The attached visual reference image defines the COMPOSITION, LAYOUT, FRAMING, CAMERA ANGLE, OBJECT PLACEMENT, DEPTH-OF-FIELD, LIGHTING DIRECTION, COLOR PALETTE, and OVERALL MOOD of the output.',
        'You MUST match these structural elements EXACTLY. Do NOT invent a different layout, do NOT change the camera angle, do NOT relocate objects, do NOT change the perspective.',
        `Replace only the hero product/subject with ${productPhrase} — keep every other compositional and atmospheric element faithful to the reference, as if the reference was the original photograph and you are only swapping the product in.`,
      ].join('\n'),
    )
    // 若 ref 比例 ≠ 輸出比例 → 加 outpaint 指令
    if (refRatio && outputRatio && refRatio !== outputRatio) {
      parts.push(buildOutpaintNote(refRatio, outputRatio))
    }
  }

  const styleModifier = STYLE_MODIFIERS[stylePreset]
  if (styleModifier) parts.push(styleModifier)

  if (additionalNotes) parts.push(`Additional requirement: ${additionalNotes}`)

  // 創意尺度視覺指令 — 緊接場景描述/風格之後、aesthetic anchors 之前,讓模型優先吸收。
  parts.push(CREATIVE_SCALE_DIRECTION[scale])

  // 品牌 aesthetic anchor(放在 negative prompt 之前,讓模型在收尾時再吸收一遍)
  // Level 1/2 預設無人物(NEGATIVE_PROMPT 禁止),所以不加 human direction
  parts.push(buildAestheticDirection(store, false, scale))

  if (level === 'level2' && adContent && adContent.title?.trim()) {
    // Level 2:把廣告文字直接燒進圖,negative prompt 依創意尺度(大膽模式放寬彩度)
    parts.push(buildTextRenderingBlock(adContent, store, scale))
    parts.push(level2NegativeForScale(scale))
  } else {
    // Level 1:保留留白給後製加字,沿用嚴格 negative prompt(禁止任何文字)
    parts.push('Leave adequate empty space in the composition for text overlay (Level 1 base image mode).')
    parts.push(NEGATIVE_PROMPT)
  }

  return parts.join('\n\n')
}

export function getSceneById(id: string): SceneTemplate | undefined {
  return SCENE_TEMPLATES.find((s) => s.id === id)
}
