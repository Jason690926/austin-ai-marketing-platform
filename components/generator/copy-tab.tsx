'use client'

import { useState, useRef, useMemo } from 'react'
import { parseSections, isStructuredPurpose } from '@/lib/copy/parse-sections'
import {
  CAMPAIGNS,
  sortCampaignsByRelevance,
  isCurrentOrUpcoming,
  categoryLabel,
  type Campaign,
} from '@/lib/copy/campaigns'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { ImagePlus, X, Copy, Check, ChevronDown, ChevronUp, Sheet, ExternalLink } from 'lucide-react'
import type { AssetStore, AssetPurpose, CtaType } from '@/types'

const CTA_TYPES: { value: CtaType; label: string; hint: string }[] = [
  { value: 'ecommerce', label: '電商', hint: '立即購買 / 加入購物車' },
  { value: 'call',      label: '來電', hint: '撥打洽詢 / 預約專人' },
  { value: 'visit',     label: '來店', hint: '來店體驗 / 前往門市' },
  { value: 'info',      label: '其他', hint: '了解更多 / 索取資訊' },
]

const STORES: { value: AssetStore; label: string }[] = [
  { value: 'mattress', label: '床墊' },
  { value: 'bedding',  label: '寢具' },
]

const PURPOSES: { value: AssetPurpose; label: string; desc: string; group: '社群' | '廣告' | '官網/SEO' }[] = [
  { value: 'fb_post',          label: 'FB 貼文',          desc: '長文型 80–300 字 · 引導互動 / 來店', group: '社群' },
  { value: 'post',             label: 'IG 貼文',          desc: '短文型 80–150 字 · 視覺優先 · 收藏分享', group: '社群' },
  { value: 'ad',               label: 'Meta 廣告',         desc: 'FB / IG 付費廣告',        group: '廣告' },
  { value: 'google_search_ad', label: 'Google 搜尋廣告 RSA', desc: '滿配 15 標題 + 4 說明 + 2 路徑',      group: '廣告' },
  { value: 'pmax_ad',          label: 'Google 多素材廣告',   desc: 'PMax / Demand Gen / Display 通用·15+5+5 滿配', group: '廣告' },
  { value: 'web_brand',        label: '品牌故事',          desc: '官網品牌介紹',            group: '官網/SEO' },
  { value: 'web_product',      label: '商品介紹',          desc: '商品頁規格說明',          group: '官網/SEO' },
  { value: 'seo_article',      label: 'SEO / AEO / GEO',  desc: '搜尋與 AI 引擎優化長文', group: '官網/SEO' },
]

const KEYWORDS_PURPOSES = new Set<AssetPurpose>(['ad', 'google_search_ad', 'pmax_ad', 'seo_article'])

export function CopyTab() {
  const [store,        setStore]        = useState<AssetStore>('mattress')
  const [purpose,      setPurpose]      = useState<AssetPurpose>('post')
  const [campaigns,    setCampaigns]    = useState<string[]>([])
  const [showAllCampaigns, setShowAllCampaigns] = useState(false)
  const [keywords,     setKeywords]     = useState('')
  const [ctaType,      setCtaType]      = useState<CtaType>('ecommerce')
  const [instructions, setInstructions] = useState('')
  const [imageFile,    setImageFile]    = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const showKeywords = KEYWORDS_PURPOSES.has(purpose)
  const showCtaType = purpose === 'ad'  // 目前僅 Meta 廣告用

  // 智能排序：依當月 (1-12) 把當月/下月檔期排前面
  const currentMonth = useMemo(() => new Date().getMonth() + 1, [])
  const sortedCampaigns = useMemo(() => sortCampaignsByRelevance(currentMonth), [currentMonth])
  const currentUpcoming = useMemo(
    () => sortedCampaigns.filter(c => isCurrentOrUpcoming(c, currentMonth)),
    [sortedCampaigns, currentMonth]
  )
  const otherCampaigns = useMemo(
    () => sortedCampaigns.filter(c => !isCurrentOrUpcoming(c, currentMonth)),
    [sortedCampaigns, currentMonth]
  )

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function toggleCampaign(id: string) {
    setCampaigns(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('圖片讀取失敗'))
      reader.readAsDataURL(file)
    })
  }

  async function handleGenerate() {
    setLoading(true)
    setErrorMsg('')
    setResult(null)
    try {
      const payload: Record<string, unknown> = { store, purpose }
      if (campaigns.length > 0) payload.campaigns = campaigns
      if (showKeywords && keywords.trim()) payload.keywords = keywords.trim()
      if (showCtaType) payload.ctaType = ctaType
      if (instructions.trim()) payload.additionalNotes = instructions.trim()
      if (imageFile) payload.referenceImageBase64 = await fileToDataUrl(imageFile)

      const res = await fetch('/api/generate/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || `產生失敗（HTTP ${res.status}）`)
        return
      }
      setResult(data.asset?.copy_text ?? '')
    } catch (e: any) {
      setErrorMsg(e?.message || '網路或未知錯誤')
    } finally {
      setLoading(false)
    }
  }

  async function copyChunk(key: string, text: string) {
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  const groups: ('社群' | '廣告' | '官網/SEO')[] = ['社群', '廣告', '官網/SEO']

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

      {/* Reference image upload */}
      <div>
        <Label className="text-sm font-medium mb-1 block">
          參考圖片
          <span className="font-normal text-muted-foreground ml-1">（選填，AI 將分析圖片氛圍產出更貼合的文案）</span>
        </Label>

        {imagePreview ? (
          <div className="relative inline-block">
            <img src={imagePreview} alt="preview" className="h-40 rounded-lg object-cover border border-border" />
            <button onClick={clearImage}
              className="absolute -top-2 -right-2 bg-background border border-border rounded-full p-0.5 text-muted-foreground hover:text-destructive transition-colors">
              <X size={14} />
            </button>
            <p className="text-xs text-muted-foreground mt-1.5">{imageFile?.name}</p>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-3 border-2 border-dashed border-border rounded-lg px-5 py-4 cursor-pointer hover:border-foreground transition-colors text-muted-foreground">
            <ImagePlus size={20} />
            <div>
              <p className="text-sm">點擊上傳圖片</p>
              <p className="text-xs mt-0.5">JPG、PNG、WEBP,最大 10MB</p>
            </div>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
      </div>

      {/* Purpose grouped */}
      <div className="space-y-3">
        <Label className="text-sm font-medium block">文案用途</Label>
        {groups.map(g => (
          <div key={g}>
            <p className="text-xs text-muted-foreground mb-1.5">{g}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PURPOSES.filter(p => p.group === g).map(p => (
                <button key={p.value} onClick={() => setPurpose(p.value)}
                  className={`text-left px-4 py-3 rounded-lg border transition-colors ${
                    purpose === p.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'}`}>
                  <p className="font-medium text-sm">{p.label}</p>
                  <p className={`text-xs mt-0.5 ${purpose === p.value ? 'opacity-70' : 'text-muted-foreground'}`}>{p.desc}</p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* CTA type (only for Meta 廣告) */}
      {showCtaType && (
        <div>
          <Label className="text-sm font-medium mb-2 block">
            CTA 類型
            <span className="font-normal text-muted-foreground ml-1">(影響行動呼籲按鈕用字)</span>
          </Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CTA_TYPES.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCtaType(c.value)}
                className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                  ctaType === c.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                }`}
              >
                <p className="font-medium text-sm">{c.label}</p>
                <p className={`text-[11px] mt-0.5 ${ctaType === c.value ? 'opacity-70' : 'text-muted-foreground'}`}>{c.hint}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Keywords (only for ad / seo) */}
      {showKeywords && (
        <div>
          <Label className="text-sm font-medium mb-2 block">
            主關鍵字
            <span className="font-normal text-muted-foreground ml-1">
              （{purpose === 'seo_article' ? '建議 1 主 + 2-3 長尾' : '廣告標題會直接帶入,逗號分隔'}）
            </span>
          </Label>
          <Input
            placeholder={
              purpose === 'seo_article'
                ? '例:獨立筒床墊推薦, 防螨抗菌枕頭, 透氣涼感床包'
                : '例:防螨床墊, 獨立筒, Sleeptrain'
            }
            value={keywords}
            onChange={e => setKeywords(e.target.value)}
          />
        </div>
      )}

      {/* Campaigns (行銷檔期) */}
      <CampaignPicker
        currentMonth={currentMonth}
        currentUpcoming={currentUpcoming}
        otherCampaigns={otherCampaigns}
        selected={campaigns}
        onToggle={toggleCampaign}
        showAll={showAllCampaigns}
        onShowAllToggle={() => setShowAllCampaigns(s => !s)}
      />

      {/* Instructions */}
      <div>
        <Label className="text-sm font-medium mb-2 block">
          額外指示 <span className="font-normal text-muted-foreground">(選填)</span>
        </Label>
        <Textarea
          placeholder="例:語氣要活潑、強調限時優惠、目標客群是新婚夫妻、字數約 150 字..."
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          rows={3}
        />
      </div>

      <Button className="w-full" size="lg" onClick={handleGenerate} disabled={loading}>
        {loading ? '產生中…(Gemini 2.5 Flash)' : '產生文案'}
      </Button>

      {errorMsg && (
        <p className="text-sm text-destructive border border-destructive/30 rounded-md p-3">
          {errorMsg}
        </p>
      )}

      {result && (
        <ResultDisplay
          text={result}
          purpose={purpose}
          campaignLabel={campaigns
            .map(id => CAMPAIGNS.find(c => c.id === id)?.label)
            .filter((s): s is string => !!s)
            .join('、')}
          structured={isStructuredPurpose(purpose)}
          copiedKey={copiedKey}
          onCopy={copyChunk}
        />
      )}
    </div>
  )
}

function ResultDisplay({
  text, purpose, campaignLabel, structured, copiedKey, onCopy,
}: {
  text: string
  purpose: AssetPurpose
  campaignLabel: string
  structured: boolean
  copiedKey: string | null
  onCopy: (key: string, text: string) => void
}) {
  const sections = structured ? parseSections(text) : []
  const useStructured = structured && sections.length > 0
  const showSheetPush = purpose === 'ad'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Label className="text-sm font-medium">產生結果</Label>
        <div className="flex items-center gap-3">
          {showSheetPush && (
            <SheetPushButton copyText={text} campaignLabel={campaignLabel} />
          )}
          <button
            onClick={() => onCopy('__all__', text)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            {copiedKey === '__all__' ? <><Check size={12} /> 已複製全部</> : <><Copy size={12} /> 複製全部</>}
          </button>
        </div>
      </div>

      {useStructured ? (
        <div className="space-y-2">
          {sections.map((s, i) => {
            const key = `s-${i}`
            return (
              <div key={key} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-muted-foreground">{s.title}</span>
                  <button
                    onClick={() => onCopy(key, s.content)}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                  >
                    {copiedKey === key ? <><Check size={11} /> 已複製</> : <><Copy size={11} /> 複製</>}
                  </button>
                </div>
                <div className="text-sm whitespace-pre-wrap leading-relaxed">{s.content}</div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-border p-4 text-sm whitespace-pre-wrap leading-relaxed">
          {text}
        </div>
      )}
      <p className="text-xs text-muted-foreground">已自動存入素材庫。</p>
    </div>
  )
}

const CATEGORY_DOT: Record<Campaign['category'], string> = {
  holiday: 'bg-rose-400',
  department: 'bg-amber-400',
  season: 'bg-emerald-400',
}

function CampaignPicker({
  currentMonth, currentUpcoming, otherCampaigns,
  selected, onToggle, showAll, onShowAllToggle,
}: {
  currentMonth: number
  currentUpcoming: Campaign[]
  otherCampaigns: Campaign[]
  selected: string[]
  onToggle: (id: string) => void
  showAll: boolean
  onShowAllToggle: () => void
}) {
  const renderChip = (c: Campaign) => {
    const active = selected.includes(c.id)
    return (
      <button
        key={c.id}
        type="button"
        onClick={() => onToggle(c.id)}
        title={c.brief}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors ${
          active
            ? 'bg-primary text-primary-foreground border-primary'
            : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
        }`}
      >
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${CATEGORY_DOT[c.category]}`} />
        <span>{c.label}</span>
        <span className="opacity-60">[{categoryLabel(c.category)}]</span>
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium block">
        行銷檔期
        <span className="font-normal text-muted-foreground ml-1">
          (選填,可多選;依當月 {currentMonth} 月智能排序)
        </span>
      </Label>

      <div>
        <p className="text-xs text-muted-foreground mb-2">本月 / 下月相關</p>
        <div className="flex flex-wrap gap-1.5">
          {currentUpcoming.length > 0
            ? currentUpcoming.map(renderChip)
            : <span className="text-xs text-muted-foreground">(本月與下月無檔期)</span>}
        </div>
      </div>

      <button
        type="button"
        onClick={onShowAllToggle}
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
      >
        {showAll
          ? <><ChevronUp size={13} /> 收起其他月份檔期</>
          : <><ChevronDown size={13} /> 展開其他月份檔期 ({otherCampaigns.length})</>}
      </button>

      {showAll && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">其他全年檔期</p>
          <div className="flex flex-wrap gap-1.5">
            {otherCampaigns.map(renderChip)}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
        <span className="inline-flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400" /> 節日</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" /> 百貨檔期</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" /> 季節主題</span>
      </div>
    </div>
  )
}

interface PushResult {
  url?: string
  frameIdx?: number
  frameLabelColumn?: string
  frameValueColumn?: string
  error?: string
  written?: Array<{ key: string; row: number; sheetLabel: string; preview: string }>
  sectionStatus?: Record<string, boolean>
  missingInSheet?: string[]
  emptyValues?: string[]
  frameMap?: Array<{ idx: number; labelCol: string; hasLabels: boolean; valuesFound: number; occupied: boolean }>
}

function SheetPushButton({ copyText, campaignLabel }: { copyText: string; campaignLabel: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PushResult | null>(null)

  // 解析所有 Headline 區塊(放寬:任何以 "Headline" 或 "標題" 開頭的區塊都算)
  const allHeadlines = useMemo(() => {
    const sections = parseSections(copyText)
    return sections
      .filter(s => /^headline/i.test(s.title) || /^短?標題/.test(s.title))
      .map(s => ({ title: s.title, content: s.content }))
  }, [copyText])

  // 預設選第 1 個。當有 2+ 個 headline 時才顯示 radio 選擇器
  const [selectedHeadlineIdx, setSelectedHeadlineIdx] = useState(0)
  const needsSelector = allHeadlines.length > 1

  async function push() {
    setLoading(true)
    setResult(null)
    try {
      const headlineOverride = allHeadlines[selectedHeadlineIdx]?.content
      const res = await fetch('/api/sheets/push-meta-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copyText, campaignLabel, headlineOverride }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        const debugStr = data.debug ? ` (debug: ${JSON.stringify(data.debug)})` : ''
        setResult({ error: (data.error || `推送失敗 (HTTP ${res.status})`) + debugStr })
      } else {
        setResult({
          url: data.sheetUrl,
          frameIdx: data.frameIdx,
          frameLabelColumn: data.frameLabelColumn,
          frameValueColumn: data.frameValueColumn,
          written: data.written,
          sectionStatus: data.sectionStatus,
          missingInSheet: data.missingInSheet,
          emptyValues: data.emptyValues,
          frameMap: data.frameMap,
        })
      }
    } catch (e: any) {
      setResult({ error: e?.message || '網路或未知錯誤' })
    } finally {
      setLoading(false)
    }
  }

  const sectionStatus = result?.sectionStatus
  const missingFromGen = sectionStatus
    ? Object.entries(sectionStatus).filter(([, v]) => !v).map(([k]) => k)
    : []

  return (
    <div className="inline-flex flex-col items-start gap-1.5">
      {needsSelector && (
        <div className="text-xs border border-border rounded-md p-2 bg-muted/30 max-w-md">
          <p className="text-[11px] text-muted-foreground mb-1">
            模型產出 {allHeadlines.length} 個主標題,但 Sheet 只能容納 1 個 — 選一個推送:
          </p>
          <div className="space-y-1">
            {allHeadlines.map((h, idx) => (
              <label
                key={idx}
                className={`flex items-start gap-2 p-1.5 rounded cursor-pointer hover:bg-muted/60 transition-colors ${
                  selectedHeadlineIdx === idx ? 'bg-muted/80' : ''
                }`}
              >
                <input
                  type="radio"
                  name="headline-pick"
                  checked={selectedHeadlineIdx === idx}
                  onChange={() => setSelectedHeadlineIdx(idx)}
                  className="mt-0.5"
                />
                <span className="text-[11px] leading-snug">
                  <span className="font-medium text-muted-foreground">{h.title}:</span> {h.content}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {!needsSelector && allHeadlines.length === 1 && (
        <p className="text-[11px] text-amber-600 max-w-md">
          ⓘ 只偵測到 1 個主標題區塊「{allHeadlines[0].title}」(系統 prompt 要求 2 個)。將直接推送這 1 個;如需多版本選擇,請重新產生(模型有時偷懶)。
        </p>
      )}
      {!needsSelector && allHeadlines.length === 0 && (
        <p className="text-[11px] text-destructive max-w-md">
          ✗ 沒偵測到任何 Headline 區塊。請檢查上方結構化結果是否有【Headline 1】等標頭;若無,請重新產生。
        </p>
      )}

      <div className="inline-flex items-center gap-2">
        <button
          onClick={push}
          disabled={loading}
          className="text-xs inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border hover:border-foreground hover:text-foreground transition-colors disabled:opacity-50"
          title="把本則 Meta 廣告填入 Google Sheet 的下一個空欄"
        >
          <Sheet size={12} />
          {loading ? '推送中…' : '推送 Google Sheet'}
        </button>

        {result?.url && (
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-emerald-600 hover:underline inline-flex items-center gap-1"
          >
            <Check size={12} /> 已寫入第 {result.frameIdx} 個 frame(label 欄 {result.frameLabelColumn} / value 欄 {result.frameValueColumn},共 {result.written?.length ?? 0} 項)
            <ExternalLink size={11} />
          </a>
        )}

        {result?.error && (
          <span className="text-xs text-destructive max-w-[400px]" title={result.error}>
            ✗ {result.error}
          </span>
        )}
      </div>

      {/* 細節:寫了什麼 / 模型缺什麼 / sheet 沒對應 */}
      {result?.url && (
        <div className="text-[11px] text-muted-foreground space-y-0.5 mt-1">
          {result.written && result.written.length > 0 && (
            <div>✅ 寫入:{result.written.map(w => `${w.key}(列 ${w.row})`).join('、')}</div>
          )}
          {missingFromGen.length > 0 && (
            <div className="text-amber-600">⚠ 模型沒產出區塊:{missingFromGen.join('、')}(請重新產生)</div>
          )}
          {result.missingInSheet && result.missingInSheet.length > 0 && (
            <div>ℹ Sheet 沒對應欄位(略過):{result.missingInSheet.join('、')}</div>
          )}
          {result.emptyValues && result.emptyValues.length > 0 && (
            <div className="text-amber-600">⚠ Sheet 有欄但模型沒產:{result.emptyValues.join('、')}</div>
          )}
          {result.frameMap && (
            <details className="mt-1">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                🗂 Frame 狀態(共 {result.frameMap.length} 個 — 排查「跳欄」用)
              </summary>
              <ul className="mt-1 space-y-0.5 pl-3">
                {result.frameMap.map(f => (
                  <li key={f.idx} className={f.occupied ? '' : 'text-amber-600'}>
                    Frame {f.idx}(label 欄 {f.labelCol}):
                    {f.hasLabels ? '有模板' : '無模板'}、
                    value 找到 {f.valuesFound} 個非空 cell
                    {f.occupied ? ' → 已占用' : ' → 空白(下一個會寫這裡)'}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
