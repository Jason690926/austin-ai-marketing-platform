'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { Star, Copy, Check, Trash2, ChevronLeft } from 'lucide-react'
import type { Asset, AssetType, AssetStore } from '@/types'

const TYPE_LABEL: Record<AssetType, string> = { copy: '文案', image: '圖片' }
const STORE_LABEL: Record<AssetStore, string> = { mattress: '席樂頓床墊', bedding: '奧斯汀寢飾' }
const PURPOSE_LABEL: Record<string, string> = {
  ad: 'Meta 廣告',
  google_search_ad: 'Google 搜尋廣告 RSA',
  pmax_ad: 'Google 多素材廣告',
  post: 'IG 貼文',
  fb_post: 'FB 貼文',
  web_brand: '品牌故事',
  web_product: '商品介紹',
  seo_article: 'SEO / AEO / GEO',
}

type TypeFilter = 'all' | AssetType
type StoreFilter = 'all' | AssetStore

function monthKeyOf(iso: string): string {
  return iso.slice(0, 7)  // "2026-05-20T..." → "2026-05"
}

function formatMonthLabel(key: string): string {
  const [y, m] = key.split('-')
  return `${y} 年 ${parseInt(m, 10)} 月`
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <dt className="w-9 text-muted-foreground shrink-0 pt-0.5">{label}</dt>
      <dd className="flex flex-wrap gap-1">{children}</dd>
    </div>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-1.5 py-0.5 rounded bg-muted text-foreground/80">
      {children}
    </span>
  )
}

interface MonthSummary {
  key: string
  label: string
  total: number
  copyCount: number
  imageCount: number
  starredCount: number
  byStore: Array<{ store: AssetStore; count: number }>     // 只列有資料的品牌
  topPurposes: Array<{ purpose: string; count: number }>   // 前 2 名
}

export function LibraryView({ initialAssets }: { initialAssets: Asset[] }) {
  const [assets, setAssets] = useState<Asset[]>(initialAssets)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [typeF, setTypeF] = useState<TypeFilter>('all')
  const [storeF, setStoreF] = useState<StoreFilter>('all')
  const [starredOnly, setStarredOnly] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Group by YYYY-MM, 月份新到舊
  const monthSummaries = useMemo<MonthSummary[]>(() => {
    const map = new Map<string, Asset[]>()
    for (const a of assets) {
      const k = monthKeyOf(a.created_at)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(a)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([k, list]) => {
        // 品牌分布(只保留 count > 0 的)
        const storeCounts: Record<AssetStore, number> = { mattress: 0, bedding: 0 }
        for (const a of list) storeCounts[a.store]++
        const byStore = (['mattress', 'bedding'] as AssetStore[])
          .filter(s => storeCounts[s] > 0)
          .map(s => ({ store: s, count: storeCounts[s] }))

        // 熱門用途 top 2
        const purposeCounts: Record<string, number> = {}
        for (const a of list) purposeCounts[a.purpose] = (purposeCounts[a.purpose] ?? 0) + 1
        const topPurposes = Object.entries(purposeCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 2)
          .map(([purpose, count]) => ({ purpose, count }))

        return {
          key: k,
          label: formatMonthLabel(k),
          total: list.length,
          copyCount: list.filter(a => a.type === 'copy').length,
          imageCount: list.filter(a => a.type === 'image').length,
          starredCount: list.filter(a => a.is_starred).length,
          byStore,
          topPurposes,
        }
      })
  }, [assets])

  const currentMonthAssets = useMemo(() => {
    if (!selectedMonth) return []
    return assets.filter(a => monthKeyOf(a.created_at) === selectedMonth)
  }, [assets, selectedMonth])

  const filtered = useMemo(() => currentMonthAssets.filter(a =>
    (typeF === 'all' || a.type === typeF) &&
    (storeF === 'all' || a.store === storeF) &&
    (!starredOnly || a.is_starred)
  ), [currentMonthAssets, typeF, storeF, starredOnly])

  async function toggleStar(a: Asset) {
    setBusyId(a.id)
    const next = !a.is_starred
    setAssets(prev => prev.map(x => x.id === a.id ? { ...x, is_starred: next } : x))
    const supabase = createClient()
    const { error } = await supabase.from('assets').update({ is_starred: next }).eq('id', a.id)
    if (error) {
      setAssets(prev => prev.map(x => x.id === a.id ? { ...x, is_starred: !next } : x))
      alert(`星號更新失敗：${error.message}`)
    }
    setBusyId(null)
  }

  async function copyText(a: Asset) {
    if (!a.copy_text) return
    await navigator.clipboard.writeText(a.copy_text)
    setCopiedId(a.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  async function deleteAsset(a: Asset) {
    const preview = a.type === 'copy'
      ? (a.copy_text?.slice(0, 30) ?? '') + '…'
      : '這張圖片'
    if (!confirm(`確定要刪除這筆素材嗎？\n\n${preview}\n\n刪除後無法復原。`)) return
    setBusyId(a.id)
    const prev = assets
    setAssets(p => p.filter(x => x.id !== a.id))
    const supabase = createClient()
    const { data, error } = await supabase.from('assets').delete().eq('id', a.id).select()
    if (error) {
      setAssets(prev)
      alert(`刪除失敗：${error.message}`)
    } else if (!data || data.length === 0) {
      setAssets(prev)
      alert('刪除未生效：資料庫尚未套用刪除權限。\n請先在 Supabase SQL Editor 執行 migration 003（新增 DELETE RLS 政策）。')
    }
    setBusyId(null)
  }

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-sm border transition-colors ${
      active ? 'bg-primary text-primary-foreground border-primary'
             : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'}`

  function enterMonth(key: string) {
    setSelectedMonth(key)
    setTypeF('all')
    setStoreF('all')
    setStarredOnly(false)
  }

  // ── Tier 1：月份 dashboard ──
  if (!selectedMonth) {
    return (
      <div className="space-y-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">素材庫</h2>
          <p className="text-xs text-muted-foreground">
            共 {monthSummaries.length} 個月份 · {assets.length} 筆素材
          </p>
        </div>

        {monthSummaries.length === 0 ? (
          <div className="rounded-lg border border-border p-16 text-center text-muted-foreground text-sm">
            還沒有素材。去產生器產生第一筆吧。
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {monthSummaries.map(m => (
              <button
                key={m.key}
                onClick={() => enterMonth(m.key)}
                className="text-left rounded-lg border border-border p-5 hover:border-foreground hover:shadow-sm transition-all flex flex-col gap-3"
              >
                {/* 標題 + 總筆數 + 星號 */}
                <div className="flex items-baseline justify-between border-b border-border pb-2.5">
                  <h3 className="text-base font-medium">{m.label}</h3>
                  <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{m.total}</span>
                    <span>筆</span>
                    {m.starredCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-yellow-600 ml-1">
                        <Star size={11} className="fill-current" /> {m.starredCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* 資訊列:類型 / 品牌 / 熱門 */}
                <dl className="space-y-1.5 text-xs">
                  <InfoRow label="類型">
                    {m.copyCount > 0 && <Pill>文案 {m.copyCount}</Pill>}
                    {m.imageCount > 0 && <Pill>圖片 {m.imageCount}</Pill>}
                  </InfoRow>

                  {m.byStore.length > 0 && (
                    <InfoRow label="品牌">
                      {m.byStore.map(b => (
                        <Pill key={b.store}>{STORE_LABEL[b.store]} {b.count}</Pill>
                      ))}
                    </InfoRow>
                  )}

                  {m.topPurposes.length > 0 && (
                    <InfoRow label="熱門">
                      {m.topPurposes.map(p => (
                        <Pill key={p.purpose}>{PURPOSE_LABEL[p.purpose] ?? p.purpose} {p.count}</Pill>
                      ))}
                    </InfoRow>
                  )}
                </dl>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Tier 2：月份內部 — filter + grid ──
  const monthMeta = monthSummaries.find(m => m.key === selectedMonth)
  const monthLabel = monthMeta?.label ?? formatMonthLabel(selectedMonth)

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setSelectedMonth(null)}
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
        >
          <ChevronLeft size={14} /> 所有月份
        </button>
        <span className="text-muted-foreground">/</span>
        <h2 className="text-base font-medium">{monthLabel}</h2>
        <span className="text-xs text-muted-foreground">共 {currentMonthAssets.length} 筆</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">類型</span>
          {(['all', 'copy', 'image'] as TypeFilter[]).map(v => (
            <button key={v} onClick={() => setTypeF(v)} className={chip(typeF === v)}>
              {v === 'all' ? '全部' : TYPE_LABEL[v]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">品牌</span>
          {(['all', 'mattress', 'bedding'] as StoreFilter[]).map(v => (
            <button key={v} onClick={() => setStoreF(v)} className={chip(storeF === v)}>
              {v === 'all' ? '全部' : STORE_LABEL[v]}
            </button>
          ))}
        </div>
        <button onClick={() => setStarredOnly(s => !s)} className={chip(starredOnly)}>
          <span className="inline-flex items-center gap-1">
            <Star size={13} className={starredOnly ? 'fill-current' : ''} /> 只看星號
          </span>
        </button>
      </div>

      <p className="text-xs text-muted-foreground">本月份篩選結果 {filtered.length} 筆</p>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border p-16 text-center text-muted-foreground text-sm">
          {currentMonthAssets.length === 0
            ? '此月份還沒有素材。'
            : '沒有符合篩選條件的素材。'}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(a => (
            <div key={a.id} className="rounded-lg border border-border p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="px-1.5 py-0.5 rounded bg-muted">{TYPE_LABEL[a.type]}</span>
                  <span className="px-1.5 py-0.5 rounded bg-muted">{STORE_LABEL[a.store]}</span>
                  <span className="px-1.5 py-0.5 rounded bg-muted">{PURPOSE_LABEL[a.purpose] ?? a.purpose}</span>
                </div>
                <button
                  onClick={() => toggleStar(a)}
                  disabled={busyId === a.id}
                  className="text-muted-foreground hover:text-yellow-500 transition-colors disabled:opacity-50"
                  title="星號"
                >
                  <Star size={16} className={a.is_starred ? 'fill-yellow-400 text-yellow-400' : ''} />
                </button>
              </div>

              {a.type === 'copy' ? (
                <p className="text-sm whitespace-pre-wrap leading-relaxed line-clamp-[12] flex-1">
                  {a.copy_text}
                </p>
              ) : a.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.image_url} alt="" className="rounded-md border border-border w-full object-cover" />
              ) : (
                <p className="text-sm text-muted-foreground flex-1">（無內容）</p>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-border">
                <span className="text-[11px] text-muted-foreground">{formatDate(a.created_at)}</span>
                <div className="flex items-center gap-3">
                  {a.type === 'copy' && a.copy_text && (
                    <button
                      onClick={() => copyText(a)}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                    >
                      {copiedId === a.id
                        ? <><Check size={12} /> 已複製</>
                        : <><Copy size={12} /> 複製</>}
                    </button>
                  )}
                  <button
                    onClick={() => deleteAsset(a)}
                    disabled={busyId === a.id}
                    className="text-[11px] text-muted-foreground hover:text-destructive transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    <Trash2 size={12} /> 刪除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
