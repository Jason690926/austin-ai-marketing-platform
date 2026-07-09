'use client'

import { useState, useMemo, useEffect } from 'react'
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
import { X, Copy, Check, ChevronDown, ChevronUp, Sheet, ExternalLink, Send, Pencil } from 'lucide-react'
import { ImageDropzone } from '@/components/image-dropzone'
import { createClient } from '@/lib/supabase/client'
import type { AssetStore, AssetPurpose, CtaType, ToneStyle, AudienceStrategy } from '@/types'

const CTA_TYPES: { value: CtaType; label: string; hint: string }[] = [
  { value: 'ecommerce', label: '電商', hint: '立即購買 / 加入購物車' },
  { value: 'call',      label: '來電', hint: '撥打洽詢 / 預約專人' },
  { value: 'visit',     label: '來店', hint: '來店體驗 / 前往門市' },
  { value: 'info',      label: '其他', hint: '了解更多 / 索取資訊' },
]
// 純內容貼文用：不放銷售 CTA（仍保留互動鉤子）。僅 FB/IG 貼文提供。
const CTA_NONE: { value: CtaType; label: string; hint: string } = {
  value: 'none', label: '不做 CTA', hint: '純內容 · 不推銷（保留互動）',
}

// A — 行銷大師語氣 persona
const TONE_STYLES: { value: ToneStyle; label: string; hint: string }[] = [
  { value: 'brand_default',  label: '品牌預設',        hint: '沿用品牌既有語氣' },
  { value: 'concise',        label: '精簡',            hint: '去蕪存菁 · 3 秒直擊' },
  { value: 'humorous',       label: '風趣幽默',        hint: '機智生活 · 高互動' },
  { value: 'ogilvy',         label: 'Ogilvy',         hint: '事實數據 · 標題決勝' },
  { value: 'wieden_kennedy', label: 'Wieden+Kennedy', hint: '賣態度 · 情緒張力' },
  { value: 'bbdo',           label: 'BBDO',           hint: '史詩敘事 · 情感驅動' },
  { value: 'gary_halbert',   label: 'Gary Halbert',   hint: '強鉤子 · 老友口吻' },
]

// B — 受眾策略（'' = 不指定）
const AUDIENCE_STRATEGIES: { value: AudienceStrategy | ''; label: string; hint: string }[] = [
  { value: '',             label: '不指定',     hint: '通用語氣' },
  { value: 'new_customer', label: '找新客',     hint: 'PAS 痛點 · 建立信任' },
  { value: 'remarketing',  label: '主顧再行銷', hint: '老友敘舊 · 破除猶豫' },
]

// 受眾策略只對「轉換型」用途有意義(社群 + 廣告 + 商品介紹);SEO 文章 / 品牌故事不顯示
const AUDIENCE_PURPOSES = new Set<AssetPurpose>([
  'ad', 'google_search_ad', 'pmax_ad', 'post', 'fb_post', 'web_product',
])

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

export function CopyTab({ isAdmin = false }: { isAdmin?: boolean }) {
  const [store,        setStore]        = useState<AssetStore>('mattress')
  const [purpose,      setPurpose]      = useState<AssetPurpose>('post')
  const [campaigns,    setCampaigns]    = useState<string[]>([])
  const [customCampaign, setCustomCampaign] = useState('')
  const [showAllCampaigns, setShowAllCampaigns] = useState(false)
  const [keywords,     setKeywords]     = useState('')
  const [ctaType,      setCtaType]      = useState<CtaType>('ecommerce')
  const [toneStyle,    setToneStyle]    = useState<ToneStyle>('brand_default')
  const [audienceStrategy, setAudienceStrategy] = useState<AudienceStrategy | ''>('')
  const [instructions, setInstructions] = useState('')
  const [imageFile,    setImageFile]    = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<string | null>(null)
  const [resultAssetId, setResultAssetId] = useState<string | null>(null)
  // 產生當下的 purpose / 檔期快照 — 結果區必須用這份渲染,
  // 否則產完後切換用途,舊結果會套新用途的按鈕/分區(例如把貼文推進廣告 Sheet)
  const [resultMeta, setResultMeta] = useState<{ purpose: AssetPurpose; campaignLabel: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const showKeywords = KEYWORDS_PURPOSES.has(purpose)
  // CTA 導向(電商/來電/來店/其他):廣告 + 社群貼文 + 官網商品都適用
  const showCtaType =
    purpose === 'ad' || purpose === 'fb_post' || purpose === 'post' || purpose === 'web_product'
  // 「不做 CTA」只給 FB/IG 純內容貼文(廣告/官網商品一定要 CTA)
  const allowNoCta = purpose === 'fb_post' || purpose === 'post'
  const ctaOptions = allowNoCta ? [...CTA_TYPES, CTA_NONE] : CTA_TYPES
  // 從社群切到廣告/官網商品時,把殘留的 'none' 還原成預設,避免送出非法值
  useEffect(() => {
    if (!allowNoCta && ctaType === 'none') setCtaType('ecommerce')
  }, [allowNoCta, ctaType])
  const showAudience = AUDIENCE_PURPOSES.has(purpose)

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

  // 驗證(型別/大小)由 ImageDropzone 統一處理,這裡只負責設檔 + 產生預覽
  function acceptImageFile(file: File) {
    setErrorMsg('')
    setImageFile(file)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(URL.createObjectURL(file))
  }

  function clearImage() {
    setImageFile(null)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(null)
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
    setResultAssetId(null)
    setResultMeta(null)
    try {
      const payload: Record<string, unknown> = { store, purpose }
      if (campaigns.length > 0) payload.campaigns = campaigns
      if (customCampaign.trim()) payload.customCampaign = customCampaign.trim()
      if (showKeywords && keywords.trim()) payload.keywords = keywords.trim()
      if (showCtaType) payload.ctaType = ctaType
      if (toneStyle !== 'brand_default') payload.toneStyle = toneStyle
      if (showAudience && audienceStrategy) payload.audienceStrategy = audienceStrategy
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
      setResultAssetId(data.asset?.id ?? null)
      setResultMeta({
        purpose,
        campaignLabel: campaigns
          .map(id => CAMPAIGNS.find(c => c.id === id)?.label)
          .filter((s): s is string => !!s)
          .join('、'),
      })
    } catch (e: any) {
      setErrorMsg(e?.message || '網路或未知錯誤')
    } finally {
      setLoading(false)
    }
  }

  async function copyChunk(key: string, text: string) {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1500)
    } catch {
      // clipboard API 在非 HTTPS(如區網 IP 開 dev)會拋錯,給提示而非默默沒反應
      setErrorMsg('複製失敗:瀏覽器不允許存取剪貼簿,請手動選取文字複製')
    }
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

      {/* Tone style (行銷大師語氣) */}
      <div>
        <Label className="text-sm font-medium mb-2 block">
          語氣風格
          <span className="font-normal text-muted-foreground ml-1">(選一位行銷大師人格,塑造文案調性)</span>
        </Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TONE_STYLES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setToneStyle(t.value)}
              className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                toneStyle === t.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
              }`}
            >
              <p className="font-medium text-sm">{t.label}</p>
              <p className={`text-[11px] mt-0.5 ${toneStyle === t.value ? 'opacity-70' : 'text-muted-foreground'}`}>{t.hint}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Reference image upload */}
      <div>
        <Label className="text-sm font-medium mb-1 block">
          參考圖片
          <span className="font-normal text-muted-foreground ml-1">（選填，AI 會辨識圖中角色／商品並寫成文案主軸）</span>
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
          <ImageDropzone onFile={acceptImageFile} onError={setErrorMsg} maxMB={10} />
        )}
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

      {/* Audience strategy (轉換型用途) */}
      {showAudience && (
        <div>
          <Label className="text-sm font-medium mb-2 block">
            受眾策略
            <span className="font-normal text-muted-foreground ml-1">(決定文案切入角度:對新客還是對熟客說話)</span>
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {AUDIENCE_STRATEGIES.map(a => (
              <button
                key={a.value || 'unset'}
                type="button"
                onClick={() => setAudienceStrategy(a.value)}
                className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                  audienceStrategy === a.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                }`}
              >
                <p className="font-medium text-sm">{a.label}</p>
                <p className={`text-[11px] mt-0.5 ${audienceStrategy === a.value ? 'opacity-70' : 'text-muted-foreground'}`}>{a.hint}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CTA type (廣告 + 社群貼文 + 官網商品) */}
      {showCtaType && (
        <div>
          <Label className="text-sm font-medium mb-2 block">
            CTA 導向
            <span className="font-normal text-muted-foreground ml-1">(行動呼籲要把人導去哪：線上購買 / 來電 / 來店 / 了解更多)</span>
          </Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ctaOptions.map(c => (
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
        customCampaign={customCampaign}
        onCustomChange={setCustomCampaign}
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
        {loading ? '產生中…(約需 10-30 秒)' : '產生文案'}
      </Button>

      {errorMsg && (
        <p className="text-sm text-destructive border border-destructive/30 rounded-md p-3">
          {errorMsg}
        </p>
      )}

      {result && resultMeta && (
        <ResultDisplay
          text={result}
          purpose={resultMeta.purpose}
          assetId={resultAssetId}
          campaignLabel={resultMeta.campaignLabel}
          structured={isStructuredPurpose(resultMeta.purpose)}
          copiedKey={copiedKey}
          onCopy={copyChunk}
          onTextChange={setResult}
          isAdmin={isAdmin}
        />
      )}
    </div>
  )
}

function ResultDisplay({
  text, purpose, assetId, campaignLabel, structured, copiedKey, onCopy, onTextChange, isAdmin,
}: {
  text: string
  purpose: AssetPurpose
  assetId: string | null
  campaignLabel: string
  structured: boolean
  copiedKey: string | null
  onCopy: (key: string, text: string) => void
  onTextChange: (next: string) => void
  isAdmin: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(text)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const sections = structured ? parseSections(text) : []
  const useStructured = structured && sections.length > 0
  const showSheetPush = purpose === 'ad'
  const showPublish = isAdmin && (purpose === 'fb_post' || purpose === 'post') && !!assetId

  function startEdit() {
    setDraft(text)
    setSaveError('')
    setEditing(true)
  }

  async function saveEdit() {
    const next = draft.trim()
    if (!next) {
      setSaveError('文案內容不可空白。')
      return
    }
    setSaving(true)
    setSaveError('')
    if (assetId) {
      const supabase = createClient()
      const { error } = await supabase
        .from('assets')
        .update({ copy_text: next })
        .eq('id', assetId)
      if (error) {
        setSaveError(`儲存失敗：${error.message}`)
        setSaving(false)
        return
      }
    }
    onTextChange(next)
    setEditing(false)
    setSaving(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Label className="text-sm font-medium">產生結果</Label>
        {!editing && (
          <div className="flex items-center gap-3">
            {showSheetPush && (
              <SheetPushButton copyText={text} campaignLabel={campaignLabel} />
            )}
            {showPublish && (
              <a
                href={`/publish?assetId=${assetId}`}
                className="text-xs inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border hover:border-foreground hover:text-foreground transition-colors"
                title="帶這篇文案到發布頁,選圖後一鍵發到粉專"
              >
                <Send size={12} /> 發布貼文
              </a>
            )}
            <button
              onClick={startEdit}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
              title="修改文案內容,可自由增刪文字"
            >
              <Pencil size={12} /> 編輯
            </button>
            <button
              onClick={() => onCopy('__all__', text)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              {copiedKey === '__all__' ? <><Check size={12} /> 已複製全部</> : <><Copy size={12} /> 複製全部</>}
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={16}
            className="text-sm leading-relaxed font-mono"
          />
          {saveError && <p className="text-xs text-destructive">{saveError}</p>}
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={saveEdit} disabled={saving}>
              {saving ? '儲存中…' : '儲存修改'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              取消
            </Button>
            <span className="text-xs text-muted-foreground">
              可自由增刪文字;{structured ? '【區塊名】標頭請保留以維持分區顯示。' : ''}儲存後會同步更新素材庫。
            </span>
          </div>
        </div>
      ) : useStructured ? (
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
      {!editing && <p className="text-xs text-muted-foreground">已自動存入素材庫。</p>}
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
  customCampaign, onCustomChange,
}: {
  currentMonth: number
  currentUpcoming: Campaign[]
  otherCampaigns: Campaign[]
  selected: string[]
  onToggle: (id: string) => void
  showAll: boolean
  onShowAllToggle: () => void
  customCampaign: string
  onCustomChange: (v: string) => void
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

      <div className="pt-1">
        <p className="text-xs text-muted-foreground mb-1.5">自訂檔期 (找不到合適的 chip 時,自己描述;可與上方 chip 並用)</p>
        <Input
          placeholder="例:週年慶 5/20–6/10 全館 8 折再送收納袋、新店開幕首三日來店禮…"
          value={customCampaign}
          onChange={e => onCustomChange(e.target.value)}
        />
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
