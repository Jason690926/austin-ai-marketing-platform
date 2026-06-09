'use client'

import { useState, useRef, useEffect } from 'react'
import { SCENE_TEMPLATES } from '@/lib/prompts/scene-templates'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { PenLine, Plus, X, Upload, ImageIcon, AlertCircle, Loader2, Download, Ruler } from 'lucide-react'
import type { Asset, AssetStore, SizePreset, StylePreset, CreativeScale } from '@/types'

type Level = 'level1' | 'level2' | 'level3'
type Mode  = 'scene' | 'reference' | 'freeform'
type StyleValue = StylePreset | 'custom'

interface AdFeature { title: string; subtitle: string }

const STORES: { value: AssetStore; label: string }[] = [
  { value: 'mattress', label: '床墊' },
  { value: 'bedding',  label: '寢具' },
]

const LEVELS: { value: Level; label: string; desc: string }[] = [
  { value: 'level1', label: '底圖模式',     desc: '乾淨底圖，供後製加字' },
  { value: 'level2', label: '完整廣告',     desc: '你填文字，AI 燒進圖' },
  { value: 'level3', label: 'AI 全權自主',  desc: '只給商品 brief，AI 想場景+寫文案' },
]

const MODES: { value: Mode; label: string; desc: string }[] = [
  { value: 'scene',     label: '場景模板', desc: '從預設場景選擇' },
  { value: 'reference', label: '參考圖片', desc: '上傳參考風格'   },
  { value: 'freeform',  label: '自由描述', desc: '自行輸入描述'   },
]

const FREEFORM_CARD = { id: 'freeform', name: '自由描述', description: '自行輸入場景描述' }

const STYLES: { value: StyleValue; label: string; dashed?: boolean }[] = [
  { value: 'auto',           label: '自動'   },
  { value: 'hotel_dark',     label: '飯店暗調' },
  { value: 'cozy_warm',      label: '溫馨暖調' },
  { value: 'minimal_clean',  label: '簡約清爽' },
  { value: 'outdoor_natural',label: '戶外自然' },
  { value: 'custom',         label: '自由描述', dashed: true },
]

// 創意尺度 — 第三條視覺軸,橫跨所有 Level。預設「寫實融入」(最安全、與現狀視覺最接近)。
const CREATIVE_SCALES: { value: CreativeScale; label: string; desc: string }[] = [
  { value: 'realistic', label: '寫實融入', desc: '自然融入場景、真實接地' },
  { value: 'playful',   label: '巧思點綴', desc: '寫實為主、加一個設計巧思' },
  { value: 'surreal',   label: '超現實大膽', desc: '刻意的超現實視覺 KV' },
]

const SIZES: { value: SizePreset; label: string; sub: string; orient: 'square' | 'portrait' | 'landscape' }[] = [
  { value: '1080x1080', label: '正方形',  sub: '1:1 · IG 貼文',       orient: 'square'    },
  { value: '1080x1350', label: '直式',    sub: '4:5 · IG 直式',       orient: 'portrait'  },
  { value: '1080x1920', label: '限時',    sub: '9:16 · Stories/Reels',orient: 'portrait'  },
  { value: '1200x675',  label: '橫式',    sub: '16:9 · Facebook',     orient: 'landscape' },
  { value: '1200x628',  label: '廣告橫幅',sub: '1.91:1 · FB 廣告',    orient: 'landscape' },
  { value: '1920x800',  label: '寬屏',    sub: '21:9 · 官網橫幅',     orient: 'landscape' },
]

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]
}

interface GenerateError { size: SizePreset; error: string }

export function ImageTab() {
  const [store,       setStore]       = useState<AssetStore>('mattress')
  const [level,       setLevel]       = useState<Level>('level1')
  const [mode,        setMode]        = useState<Mode>('scene')
  const [sceneId,     setSceneId]     = useState<string>('hotel_suite')
  const [description, setDescription] = useState('')
  const [freeformDesc,setFreeformDesc]= useState('')
  const [style,       setStyle]       = useState<StyleValue>('auto')
  const [styleDesc,   setStyleDesc]   = useState('')
  const [creativeScale, setCreativeScale] = useState<CreativeScale>('realistic')
  const [sizes,       setSizes]       = useState<SizePreset[]>(['1080x1080'])

  // 自訂尺寸(像素)
  const [customEnabled, setCustomEnabled] = useState(false)
  const [customWidth,   setCustomWidth]   = useState('1080')
  const [customHeight,  setCustomHeight]  = useState('1080')

  // 商品圖(全模式適用,商品本身保留,AI 只重生背景/氛圍)
  const productInputRef = useRef<HTMLInputElement>(null)
  const [productFile, setProductFile] = useState<File | null>(null)
  const [productPreview, setProductPreview] = useState<string | null>(null)

  // 場景參考圖(僅 reference 模式)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [referenceFile, setReferenceFile] = useState<File | null>(null)
  const [referencePreview, setReferencePreview] = useState<string | null>(null)

  // Level 2 ad fields
  const [adTitle,       setAdTitle]       = useState('')
  const [adSubtitle,    setAdSubtitle]    = useState('')
  const [adEndorsement, setAdEndorsement] = useState('')
  const [adFeatures,    setAdFeatures]    = useState<AdFeature[]>([{ title: '', subtitle: '' }])

  // Level 3 (AI 全權自主) fields
  const [productBrief,   setProductBrief]   = useState('')
  const [catalogCount,   setCatalogCount]   = useState(1)
  const [lifestyleCount, setLifestyleCount] = useState(2)

  // 產圖狀態
  const [isGenerating, setIsGenerating] = useState(false)
  const [results, setResults] = useState<Asset[]>([])
  const [errors, setErrors] = useState<GenerateError[]>([])
  const [topError, setTopError] = useState<string | null>(null)

  const isFreeformScene = sceneId === 'freeform'

  // API 呼叫次數 = preset 數 + (有自訂 ? 1 : 0);Level 3 還要 × 變體數
  const selectedOrients = Array.from(new Set(SIZES.filter(s => sizes.includes(s.value)).map(s => s.orient)))
  const customParsed = (() => {
    const w = parseInt(customWidth, 10)
    const h = parseInt(customHeight, 10)
    if (Number.isInteger(w) && Number.isInteger(h) && w >= 256 && h >= 256 && w <= 4096 && h <= 4096) {
      return { w, h }
    }
    return null
  })()
  const customValid = customEnabled && customParsed !== null
  const baseSizeCount = sizes.length + (customValid ? 1 : 0)
  const l3VariantCount = level === 'level3' ? catalogCount + lifestyleCount : 1
  const apiCallCount = baseSizeCount * l3VariantCount

  function addFeature() {
    if (adFeatures.length < 3) setAdFeatures([...adFeatures, { title: '', subtitle: '' }])
  }
  function removeFeature(i: number) {
    setAdFeatures(adFeatures.filter((_, idx) => idx !== i))
  }
  function updateFeature(i: number, field: keyof AdFeature, val: string) {
    setAdFeatures(adFeatures.map((f, idx) => idx === i ? { ...f, [field]: val } : f))
  }

  function validateImageFile(file: File): string | null {
    if (!file.type.startsWith('image/')) return '請上傳圖片檔案(JPG / PNG / WebP)'
    if (file.size > 5 * 1024 * 1024) return '圖片超過 5MB,請選小一點的檔案'
    return null
  }

  function handleProductUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const err = validateImageFile(file)
    if (err) { setTopError(err); return }
    setTopError(null)
    setProductFile(file)
    if (productPreview) URL.revokeObjectURL(productPreview)
    setProductPreview(URL.createObjectURL(file))
  }
  function clearProduct() {
    setProductFile(null)
    if (productPreview) URL.revokeObjectURL(productPreview)
    setProductPreview(null)
    if (productInputRef.current) productInputRef.current.value = ''
  }

  function handleReferenceUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const err = validateImageFile(file)
    if (err) { setTopError(err); return }
    setTopError(null)
    setReferenceFile(file)
    if (referencePreview) URL.revokeObjectURL(referencePreview)
    setReferencePreview(URL.createObjectURL(file))
  }
  function clearReference() {
    setReferenceFile(null)
    if (referencePreview) URL.revokeObjectURL(referencePreview)
    setReferencePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }
  useEffect(() => {
    return () => {
      if (referencePreview) URL.revokeObjectURL(referencePreview)
      if (productPreview) URL.revokeObjectURL(productPreview)
    }
  }, [referencePreview, productPreview])

  // 表單驗證
  const canGenerate = (() => {
    // 至少要有一個 preset 或一個有效自訂尺寸
    if (sizes.length === 0 && !customValid) return false
    // 自訂尺寸啟用但無效(輸入錯)→ 擋
    if (customEnabled && !customValid) return false
    // Level 2 至少需要主標題
    if (level === 'level2' && !adTitle.trim()) return false
    // Level 3 要 brief + 至少 1 個變體
    if (level === 'level3') {
      if (!productBrief.trim()) return false
      if (catalogCount + lifestyleCount === 0) return false
      if (catalogCount + lifestyleCount > 6) return false
      return true  // Level 3 不需要其他 mode/scene 設定
    }
    if (mode === 'scene') {
      if (sceneId === 'freeform' && !description.trim()) return false
      return true
    }
    if (mode === 'reference') return !!referenceFile
    if (mode === 'freeform') return freeformDesc.trim().length > 0
    return false
  })()

  // 下載圖檔 — fetch as blob 再觸發,因 Supabase Storage 跨網域,直接 <a download> 不能強制下載
  async function downloadAsset(asset: Asset) {
    if (!asset.image_url) return
    try {
      const res = await fetch(asset.image_url)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `${asset.store}-${asset.width}x${asset.height}-${asset.id.slice(0, 8)}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (e) {
      setTopError(`下載失敗:${(e as Error).message}`)
    }
  }

  async function handleGenerate() {
    if (!canGenerate || isGenerating) return
    setIsGenerating(true)
    setResults([])
    setErrors([])
    setTopError(null)

    try {
      const form = new FormData()
      form.append('mode', mode)
      form.append('store', store)
      form.append('level', level)
      if (level === 'level2') {
        form.append('adContent', JSON.stringify({
          title: adTitle.trim(),
          subtitle: adSubtitle.trim() || undefined,
          endorsement: adEndorsement.trim() || undefined,
          features: adFeatures
            .filter(f => f.title.trim())
            .map(f => ({ title: f.title.trim(), subtitle: f.subtitle.trim() || undefined })),
        }))
      }
      if (level === 'level3') {
        form.append('productBrief', productBrief.trim())
        form.append('catalogCount', String(catalogCount))
        form.append('lifestyleCount', String(lifestyleCount))
      }
      if (mode === 'scene') form.append('sceneId', sceneId)
      form.append('description', description)
      form.append('freeformDesc', freeformDesc)
      form.append('stylePreset', style)
      form.append('styleDesc', styleDesc)
      form.append('creativeScale', creativeScale)
      form.append('sizes', JSON.stringify(sizes))
      if (customValid && customParsed) {
        form.append('customSize', JSON.stringify({ width: customParsed.w, height: customParsed.h }))
      }
      if (productFile) form.append('productImage', productFile)
      if (referenceFile) form.append('referenceImage', referenceFile)

      const res = await fetch('/api/generate/image', { method: 'POST', body: form })
      const json = await res.json()

      if (!res.ok) {
        setTopError(json?.error || `產圖失敗(${res.status})`)
        return
      }

      setResults(json.assets || [])
      setErrors(json.errors || [])
      if ((json.assets?.length || 0) === 0 && (json.errors?.length || 0) > 0) {
        setTopError('所有尺寸都失敗了,看下方錯誤訊息')
      }
    } catch (e: any) {
      setTopError(`網路或伺服器錯誤:${e?.message || '未知錯誤'}`)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-8">

      {/* Store */}
      <div>
        <Label className="text-sm font-medium mb-2 block">品牌 / 門市</Label>
        <div className="flex gap-2">
          {STORES.map(s => (
            <button key={s.value} onClick={() => setStore(s.value)}
              className={`px-4 py-1.5 rounded-md text-sm border transition-colors ${
                store === s.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 商品圖(選填,全模式適用) */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <Label className="text-sm font-medium">商品圖 <span className="text-xs font-normal text-muted-foreground">（選填）</span></Label>
          {productFile && (
            <span className="text-xs text-muted-foreground">已上傳：{productFile.name}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
          上傳實際商品照片（如真實床墊、寢飾組）→ AI 會保留商品原樣不變，只重新生成背景與氛圍。<br />
          不上傳則用品牌通用形象。可與下方「參考圖片」模式同時使用（商品圖定主角、參考圖定氛圍）。
        </p>
        <input
          ref={productInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleProductUpload}
        />
        {!productPreview ? (
          <button
            type="button"
            onClick={() => productInputRef.current?.click()}
            className="w-full border-2 border-dashed border-border rounded-lg p-6 text-center text-muted-foreground text-sm hover:border-foreground hover:text-foreground transition-colors flex flex-col items-center gap-1.5"
          >
            <Upload size={18} />
            <span>點擊上傳商品照</span>
            <span className="text-xs">JPG、PNG、WebP，最大 5MB</span>
          </button>
        ) : (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={productPreview} alt="商品圖" className="max-h-48 rounded-lg border border-border" />
            <button
              type="button"
              onClick={clearProduct}
              className="absolute -top-2 -right-2 bg-background border border-border rounded-full p-1 hover:bg-muted"
              aria-label="移除商品圖"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Level */}
      <div>
        <Label className="text-sm font-medium mb-2 block">產圖層級</Label>
        <div className="flex gap-3">
          {LEVELS.map(l => (
            <button key={l.value} onClick={() => setLevel(l.value)}
              className={`flex flex-col items-start px-4 py-3 rounded-lg border transition-colors flex-1 ${
                level === l.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'}`}>
              <span className="font-medium text-sm">{l.label}</span>
              <span className="text-xs opacity-70 mt-0.5">{l.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Level 3: AI 全權自主 — 商品 brief + 變體數 */}
      {level === 'level3' && (
        <div className="space-y-4 rounded-lg border border-border p-5">
          <div>
            <Label className="text-sm font-semibold block">商品 brief</Label>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              寫商品名、材質、尺寸、銷售目標、想呈現的賣點。AI 會自己挑場景、寫文案、設計版面、燒進圖。
              <br />
              注意：模式、場景模板、風格調性、單獨的廣告文字欄位都用不到，AI 自己決定。
            </p>
            <Textarea
              rows={8}
              value={productBrief}
              onChange={e => setProductBrief(e.target.value)}
              placeholder={`例：\n商品「韓國森萃莫代爾晚安被」共 4 款花色\n材質：100% 莫代爾纖維\n尺寸：155×205cm\n銷售目標：官網販售\n要呈現：商品優點 + 莫代爾纖維特性（親膚、抗菌、透氣）\n調性：質感創意行銷目錄`}
              className="mt-2 font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">目錄圖（無人物，商品為主）</Label>
              <Input
                type="number"
                min={0}
                max={3}
                value={catalogCount}
                onChange={e => setCatalogCount(Math.max(0, Math.min(3, parseInt(e.target.value, 10) || 0)))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">人物情境（生活場景，含人物）</Label>
              <Input
                type="number"
                min={0}
                max={6}
                value={lifestyleCount}
                onChange={e => setLifestyleCount(Math.max(0, Math.min(6, parseInt(e.target.value, 10) || 0)))}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            總共產 {catalogCount + lifestyleCount} 張變體 × 下方選的尺寸數 = <span className="font-semibold text-foreground">{(catalogCount + lifestyleCount) * baseSizeCount || 0} 次 API 呼叫</span>
            {catalogCount + lifestyleCount > 6 && <span className="text-destructive ml-2">變體總數上限 6</span>}
          </p>
        </div>
      )}

      {/* Mode + Scene/Reference/Freeform + Style + Level 2 — Level 3 全部隱藏,AI 自己決定 */}
      {level !== 'level3' && (
      <>
      <div>
        <Label className="text-sm font-medium mb-2 block">背景場景模式</Label>
        <div className="flex gap-2">
          {MODES.map(m => (
            <button key={m.value} onClick={() => setMode(m.value)}
              className={`flex flex-col items-start px-4 py-2.5 rounded-md text-sm border transition-colors ${
                mode === m.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'}`}>
              <span className="font-medium">{m.label}</span>
              <span className="text-xs opacity-70">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Scene templates */}
      {mode === 'scene' && (
        <div className="space-y-4">
          <Label className="text-sm font-medium block">場景模板</Label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SCENE_TEMPLATES.map(t => {
              const active = sceneId === t.id
              return (
                <button key={t.id} onClick={() => setSceneId(t.id)}
                  className={`text-left p-3.5 rounded-lg border transition-colors ${
                    active ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-foreground'}`}>
                  <p className="font-medium text-sm">{t.name}</p>
                  <p className={`text-xs mt-0.5 ${active ? 'opacity-70' : 'text-muted-foreground'}`}>{t.description}</p>
                </button>
              )
            })}
            <button onClick={() => setSceneId('freeform')}
              className={`text-left p-3.5 rounded-lg border border-dashed transition-colors ${
                isFreeformScene ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-foreground'}`}>
              <p className="font-medium text-sm flex items-center gap-1.5"><PenLine size={13} />{FREEFORM_CARD.name}</p>
              <p className={`text-xs mt-0.5 ${isFreeformScene ? 'opacity-70' : 'text-muted-foreground'}`}>{FREEFORM_CARD.description}</p>
            </button>
          </div>
          {isFreeformScene
            ? <Textarea placeholder="例：北歐風格白色臥室，大片窗戶透入清晨陽光..." value={description} onChange={e => setDescription(e.target.value)} rows={4} />
            : <div>
                <Label className="text-sm text-muted-foreground mb-1.5 block">補充描述 <span className="text-xs">（選填）</span></Label>
                <Textarea placeholder="例：床頭板要有金屬邊框、窗簾要半開..." value={description} onChange={e => setDescription(e.target.value)} rows={2} />
              </div>
          }
        </div>
      )}

      {/* Reference mode */}
      {mode === 'reference' && (
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">上傳參考圖片</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleReferenceUpload}
            />
            {!referencePreview ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-lg p-10 text-center text-muted-foreground text-sm hover:border-foreground hover:text-foreground transition-colors flex flex-col items-center gap-1.5"
              >
                <Upload size={20} />
                <span>點擊上傳圖片</span>
                <span className="text-xs">JPG、PNG、WebP，最大 5MB</span>
              </button>
            ) : (
              <div className="relative inline-block">
                <img src={referencePreview} alt="參考圖" className="max-h-64 rounded-lg border border-border" />
                <button
                  type="button"
                  onClick={clearReference}
                  className="absolute -top-2 -right-2 bg-background border border-border rounded-full p-1 hover:bg-muted"
                  aria-label="移除參考圖"
                >
                  <X size={14} />
                </button>
                <p className="text-xs text-muted-foreground mt-1.5">{referenceFile?.name}</p>
              </div>
            )}
          </div>
          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">場景補充描述 <span className="text-xs">（選填）</span></Label>
            <Textarea placeholder="例：保留參考圖的暖調光線，但場景改為室內..." value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </div>
        </div>
      )}

      {/* Freeform mode */}
      {mode === 'freeform' && (
        <div>
          <Label className="text-sm font-medium mb-2 block">場景描述</Label>
          <Textarea placeholder="例：北歐風格白色臥室，大片窗戶透入清晨陽光，床單為霧灰色亞麻布..." value={freeformDesc} onChange={e => setFreeformDesc(e.target.value)} rows={4} />
        </div>
      )}

      {/* Style */}
      <div className="space-y-3">
        <Label className="text-sm font-medium block">風格調性</Label>
        <div className="flex flex-wrap gap-2">
          {STYLES.map(s => {
            const active = style === s.value
            return (
              <button key={s.value} onClick={() => setStyle(s.value)}
                className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${s.dashed ? 'border-dashed' : ''} ${
                  active ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'}`}>
                {s.label}
              </button>
            )
          })}
        </div>
        {style === 'custom' && (
          <Textarea placeholder="例：電影感冷藍調、霧面質感、強烈側光打在床墊布料上..." value={styleDesc} onChange={e => setStyleDesc(e.target.value)} rows={2} />
        )}
      </div>

      {/* Level 2: Ad content fields */}
      {level === 'level2' && (
        <div className="space-y-4 rounded-lg border border-border p-5">
          <div>
            <Label className="text-sm font-semibold block">廣告文字內容</Label>
            <p className="text-xs text-muted-foreground mt-1">
              AI 會把以下文字直接渲染進圖。預設使用 Nano Banana 2（3.1 Flash Image），中文字渲染品質佳；若要省成本可在 <code className="text-[10px]">.env.local</code> 設 <code className="text-[10px]">GEMINI_IMAGE_MODEL=gemini-2.5-flash-image</code> 降回標準級，或設 <code className="text-[10px]">gemini-3-pro-image-preview</code> 升到最高品質。
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">廣告標題 <span className="text-destructive">*</span></Label>
            <Input
              placeholder={store === 'mattress' ? '例：席樂頓夏季新品' : '例：SNOOPY 聯名床包上市'}
              value={adTitle}
              onChange={e => setAdTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">副標題 <span>（選填）</span></Label>
            <Input
              placeholder={store === 'mattress' ? '例：來自美國加州的奢華睡眠' : '例：睡得好，生活更美好'}
              value={adSubtitle}
              onChange={e => setAdSubtitle(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">背書標語 <span>（選填）</span></Label>
            <Input
              placeholder={store === 'mattress' ? '例：全美十大知名床墊品牌' : '例：1960 創立．近 300 家通路'}
              value={adEndorsement}
              onChange={e => setAdEndorsement(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">產品賣點 <span>（最多 3 項）</span></Label>
              {adFeatures.length < 3 && (
                <button type="button" onClick={addFeature} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Plus size={12} /> 新增賣點
                </button>
              )}
            </div>
            {adFeatures.map((f, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1.5">
                  <Input
                    placeholder={`賣點 ${i + 1} 標題，例：${store === 'mattress' ? '獨立筒支撐' : 'Sanitized 防螨抗菌'}`}
                    value={f.title}
                    onChange={e => updateFeature(i, 'title', e.target.value)}
                  />
                  <Input
                    placeholder="副說明（選填）"
                    value={f.subtitle}
                    onChange={e => updateFeature(i, 'subtitle', e.target.value)}
                  />
                </div>
                {adFeatures.length > 1 && (
                  <button type="button" onClick={() => removeFeature(i)} className="mt-1 text-muted-foreground hover:text-destructive transition-colors">
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      </>
      )}

      {/* 創意尺度 — 第三條視覺軸,橫跨所有 Level(故放在 level!=='level3' 區塊外) */}
      <div className="space-y-2">
        <Label className="text-sm font-medium block">創意尺度</Label>
        <div className="flex flex-wrap gap-2">
          {CREATIVE_SCALES.map(cs => {
            const active = creativeScale === cs.value
            return (
              <button
                key={cs.value}
                type="button"
                onClick={() => setCreativeScale(cs.value)}
                title={cs.desc}
                className={`flex flex-col items-start px-3 py-2 rounded-md text-sm border transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                }`}
              >
                <span className="font-medium">{cs.label}</span>
                <span className="text-xs opacity-70">{cs.desc}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Size multi-select */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium">尺寸規格 <span className="font-normal text-muted-foreground text-xs">（可多選）</span></Label>
          <span className="text-xs text-muted-foreground">
            已選 {sizes.length + (customValid ? 1 : 0)} 個{apiCallCount > 0 ? `・${apiCallCount} 次 API 呼叫` : ''}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
          {SIZES.map(s => {
            const active = sizes.includes(s.value)
            return (
              <button key={s.value} onClick={() => setSizes(toggle(sizes, s.value))}
                className={`flex flex-col items-center px-2 py-2.5 rounded-md text-sm border transition-colors ${
                  active ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'}`}>
                <span className="font-medium text-xs">{s.label}</span>
                <span className="text-[10px] opacity-70 mt-0.5 leading-tight text-center">{s.sub}</span>
              </button>
            )
          })}
          <button
            onClick={() => setCustomEnabled(v => !v)}
            className={`flex flex-col items-center px-2 py-2.5 rounded-md text-sm border border-dashed transition-colors ${
              customEnabled ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'}`}>
            <span className="font-medium text-xs flex items-center gap-1"><Ruler size={11} />自訂</span>
            <span className="text-[10px] opacity-70 mt-0.5 leading-tight text-center">輸入像素</span>
          </button>
        </div>

        {customEnabled && (
          <div className="mt-3 border border-border rounded-md p-3 space-y-2 bg-muted/30">
            <Label className="text-xs text-muted-foreground">自訂尺寸（像素，256-4096）</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={256}
                max={4096}
                value={customWidth}
                onChange={e => setCustomWidth(e.target.value)}
                placeholder="寬"
                className="w-24"
              />
              <span className="text-muted-foreground text-sm">×</span>
              <Input
                type="number"
                min={256}
                max={4096}
                value={customHeight}
                onChange={e => setCustomHeight(e.target.value)}
                placeholder="高"
                className="w-24"
              />
              <span className="text-xs text-muted-foreground ml-2">
                {customValid && customParsed
                  ? `比例 ${(customParsed.w / customParsed.h).toFixed(2)}：1 → 模型取最接近支援值，sharp 裁到精確 ${customParsed.w}×${customParsed.h}`
                  : '需在 256-4096 範圍的整數'}
              </span>
            </div>
          </div>
        )}

        {selectedOrients.length > 1 && (
          <p className="text-xs text-muted-foreground mt-2">
            跨方向（直式 / 橫式 / 方形）會分別產圖，比例由模型重新構圖確保商品不被截斷。
          </p>
        )}
      </div>

      {/* 錯誤訊息 */}
      {topError && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{topError}</span>
        </div>
      )}

      <Button
        className="w-full"
        size="lg"
        disabled={!canGenerate || isGenerating}
        onClick={handleGenerate}
      >
        {isGenerating ? (
          <span className="flex items-center gap-2">
            <Loader2 size={16} className="animate-spin" />
            產圖中（{apiCallCount} 次 API）…
          </span>
        ) : level === 'level2' ? (
          `產生完整廣告（${apiCallCount} 次 API 呼叫）`
        ) : (
          `產生底圖（${apiCallCount} 次 API 呼叫）`
        )}
      </Button>

      {/* 結果區 */}
      {(results.length > 0 || errors.length > 0) && (
        <div className="space-y-3 border-t border-border pt-6">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">產圖結果</Label>
            <span className="text-xs text-muted-foreground">
              成功 {results.length} / 失敗 {errors.length}
            </span>
          </div>

          {results.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {results.map(asset => {
                const sizeLabel = SIZES.find(s => `${s.value}` === `${asset.width}x${asset.height}`)?.label
                  || `${asset.width}×${asset.height}`
                return (
                  <div key={asset.id} className="border border-border rounded-lg overflow-hidden bg-muted/30">
                    {asset.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset.image_url}
                        alt={`產圖結果 ${sizeLabel}`}
                        className="w-full aspect-square object-cover"
                      />
                    )}
                    <div className="p-2.5 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{sizeLabel}</span>
                        <span className="text-muted-foreground">{asset.aspect_ratio}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => downloadAsset(asset)}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md border border-border hover:bg-muted text-foreground transition-colors"
                        >
                          <Download size={11} /> 下載
                        </button>
                        <a
                          href="/library"
                          className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ImageIcon size={11} /> 素材庫
                        </a>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {errors.length > 0 && (
            <div className="space-y-1.5">
              {errors.map((e, i) => (
                <div key={i} className="text-xs flex items-start gap-1.5 text-destructive">
                  <AlertCircle size={12} className="mt-0.5 shrink-0" />
                  <span><span className="font-medium">{e.size}</span> — {e.error}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
