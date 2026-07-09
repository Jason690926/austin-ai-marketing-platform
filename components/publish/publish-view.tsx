'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { X, Check, ExternalLink, AlertTriangle } from 'lucide-react'
import { ImageDropzone } from '@/components/image-dropzone'
import type { Asset, AssetPurpose, PublishPageResult } from '@/types'

interface MetaPagePublicProp {
  pageId: string
  pageName: string
}

import { STORE_LABEL, PURPOSE_LABEL } from '@/lib/constants'

function assetLabel(a: Asset): string {
  const head = `[${STORE_LABEL[a.store] ?? a.store}·${PURPOSE_LABEL[a.purpose] ?? a.purpose}]`
  const preview = (a.copy_text ?? '').replace(/\s+/g, ' ').slice(0, 30)
  return `${head} ${preview}${(a.copy_text ?? '').length > 30 ? '…' : ''}`
}

export function PublishView({
  pages,
  pagesError,
  copyAssets,
  initialAssetId,
}: {
  pages: MetaPagePublicProp[]
  pagesError: string | null
  copyAssets: Asset[]
  initialAssetId: string | null
}) {
  const initialAsset = useMemo(
    () => copyAssets.find(a => a.id === initialAssetId) ?? null,
    [copyAssets, initialAssetId],
  )

  const [selectedAssetId, setSelectedAssetId] = useState<string>(initialAsset?.id ?? '')
  const [copyText, setCopyText] = useState<string>(initialAsset?.copy_text ?? '')
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>(pages.map(p => p.pageId))
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [results, setResults] = useState<PublishPageResult[] | null>(null)
  const [recordWarning, setRecordWarning] = useState<string | null>(null)

  function pickAsset(id: string) {
    setSelectedAssetId(id)
    const a = copyAssets.find(x => x.id === id)
    if (a?.copy_text) setCopyText(a.copy_text)
  }

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

  function togglePage(id: string) {
    setSelectedPageIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    )
  }

  // 已有結果 = 本批已發布過:鎖住發布鈕,避免誤按第二下對同批粉專重複發文;
  // 要再發須走「發布下一篇」明確重置
  const alreadyPublished = results !== null
  const canPublish =
    !pagesError &&
    copyText.trim().length > 0 &&
    !!imageFile &&
    selectedPageIds.length > 0 &&
    !loading &&
    !alreadyPublished

  function resetForNext() {
    setResults(null)
    setRecordWarning(null)
    setErrorMsg('')
    setCopyText('')
    setSelectedAssetId('')
    clearImage()
  }

  async function handlePublish() {
    setLoading(true)
    setErrorMsg('')
    setResults(null)
    setRecordWarning(null)
    try {
      const form = new FormData()
      form.append('copyText', copyText.trim())
      if (selectedAssetId) form.append('assetId', selectedAssetId)
      form.append('pageIds', JSON.stringify(selectedPageIds))
      form.append('image', imageFile!)

      const res = await fetch('/api/posts/publish', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || `發布失敗(HTTP ${res.status}）`)
        return
      }
      setResults(data.results as PublishPageResult[])
      setRecordWarning(data.recordWarning ?? null)
    } catch (e: any) {
      setErrorMsg(e?.message || '網路或未知錯誤')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">

      {/* 文案 */}
      <div>
        <Label className="text-sm font-medium mb-2 block">文案內容</Label>
        {copyAssets.length > 0 && (
          <select
            value={selectedAssetId}
            onChange={e => pickAsset(e.target.value)}
            className="w-full mb-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">— 從素材庫挑選文案,或直接於下方輸入 —</option>
            {copyAssets.map(a => (
              <option key={a.id} value={a.id}>{assetLabel(a)}</option>
            ))}
          </select>
        )}
        <Textarea
          placeholder="貼文文字內容…可從上方素材庫挑選帶入,也可直接編輯"
          value={copyText}
          onChange={e => setCopyText(e.target.value)}
          rows={8}
        />
        <p className="text-xs text-muted-foreground mt-1">{copyText.length} 字</p>
      </div>

      {/* 圖片 */}
      <div>
        <Label className="text-sm font-medium mb-1 block">
          貼文圖片
          <span className="font-normal text-muted-foreground ml-1">（必填,發布後不會留存於系統）</span>
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

      {/* 發布粉專 */}
      <div>
        <Label className="text-sm font-medium mb-2 block">發布粉專</Label>
        {pagesError ? (
          <p className="text-sm text-destructive border border-destructive/30 rounded-md p-3">
            ✗ {pagesError}（請於 .env.local 設定 META_PAGE_ID / META_PAGE_ACCESS_TOKEN 後重啟 dev server）
          </p>
        ) : (
          <div className="space-y-1.5">
            {pages.map(p => (
              <label
                key={p.pageId}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-border cursor-pointer hover:border-foreground transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedPageIds.includes(p.pageId)}
                  onChange={() => togglePage(p.pageId)}
                />
                <span className="text-sm">{p.pageName}</span>
                <span className="text-xs text-muted-foreground ml-auto">{p.pageId}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <Button className="w-full" size="lg" onClick={handlePublish} disabled={!canPublish}>
        {loading
          ? '發布中…'
          : alreadyPublished
            ? '本批已發布(要再發請按下方「發布下一篇」)'
            : `發布到 ${selectedPageIds.length} 個粉專`}
      </Button>

      {errorMsg && (
        <p className="text-sm text-destructive border border-destructive/30 rounded-md p-3">
          {errorMsg}
        </p>
      )}

      {results && (
        <>
          <ResultList results={results} recordWarning={recordWarning} />
          <Button variant="outline" className="w-full" onClick={resetForNext}>
            發布下一篇(清空文案與圖片)
          </Button>
        </>
      )}
    </div>
  )
}

function ResultList({
  results,
  recordWarning,
}: {
  results: PublishPageResult[]
  recordWarning: string | null
}) {
  const successCount = results.filter(r => r.status === 'success').length
  const failedCount = results.length - successCount

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        發布結果 — 成功 {successCount} / 失敗 {failedCount}
      </Label>

      {recordWarning && (
        <p className="text-xs text-amber-600 border border-amber-300 rounded-md p-2">
          ⚠ {recordWarning}
        </p>
      )}

      <div className="space-y-1.5">
        {results.map(r => (
          <div
            key={r.page_id}
            className={`rounded-lg border p-3 text-sm ${
              r.status === 'success'
                ? 'border-emerald-300 bg-emerald-50/50'
                : 'border-destructive/40 bg-destructive/5'
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              {r.status === 'success' ? (
                <Check size={14} className="text-emerald-600" />
              ) : (
                <AlertTriangle size={14} className="text-destructive" />
              )}
              <span className="font-medium">{r.page_name}</span>
              {r.attempts > 1 && (
                <span className="text-[11px] text-muted-foreground">
                  （重試第 {r.attempts} 次）
                </span>
              )}
              {r.status === 'success' && r.meta_post_id && (
                <a
                  href={`https://www.facebook.com/${r.meta_post_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-emerald-700 hover:underline inline-flex items-center gap-1 ml-auto"
                >
                  在 Facebook 查看 <ExternalLink size={11} />
                </a>
              )}
            </div>
            {r.status === 'failed' && (
              <p className="text-xs text-destructive mt-1">
                ✗ {r.error}（已重試 1 次仍失敗,請人工確認後重新發布）
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
