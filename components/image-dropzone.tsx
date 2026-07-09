'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Upload } from 'lucide-react'

// 全站共用的圖片上傳區(點擊 / 拖曳並存)。
// 統一:型別 + 大小驗證、鍵盤可及性(button 而非 div)、拖曳經過子元素不閃爍。
// 預覽與清除由呼叫端自行渲染(各處版型不同);本元件只負責「空狀態的收件區」。

export function ImageDropzone({
  onFile,
  onError,
  maxMB = 10,
  label = '點擊或拖曳上傳圖片',
  dragLabel = '放開以上傳圖片',
  hint,
  layout = 'row',
}: {
  onFile: (file: File) => void
  onError: (msg: string) => void
  maxMB?: number
  label?: string
  dragLabel?: string
  hint?: string
  layout?: 'row' | 'column'   // row = 精簡橫排(文案/發布頁),column = 置中直排(產圖頁)
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const hintText = hint ?? `JPG、PNG、WebP，最大 ${maxMB}MB`

  function accept(file: File | null | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      onError('請上傳圖片檔案(JPG / PNG / WebP)')
      return
    }
    if (file.size > maxMB * 1024 * 1024) {
      onError(`圖片超過 ${maxMB}MB 上限，請選小一點的檔案`)
      return
    }
    onFile(file)
  }

  const Icon = layout === 'row' ? ImagePlus : Upload
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        // 選完清空 value,同一檔案可重選,呼叫端也不必再操作 input ref
        onChange={e => { accept(e.target.files?.[0]); e.target.value = '' }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={e => {
          // 拖曳滑過內部 icon / 文字也會觸發 dragleave,離開整個區塊才取消高亮
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
        }}
        onDrop={e => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files?.[0]) }}
        className={`w-full border-2 border-dashed rounded-lg text-sm transition-colors ${
          layout === 'row'
            ? 'flex items-center gap-3 px-5 py-4 text-left'
            : 'flex flex-col items-center gap-1.5 p-6 text-center'
        } ${
          dragging
            ? 'border-foreground text-foreground bg-muted/50'
            : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
        }`}
      >
        <Icon size={layout === 'row' ? 20 : 18} />
        {layout === 'row' ? (
          <span>
            <span className="block">{dragging ? dragLabel : label}</span>
            <span className="block text-xs mt-0.5">{hintText}</span>
          </span>
        ) : (
          <>
            <span>{dragging ? dragLabel : label}</span>
            <span className="text-xs">{hintText}</span>
          </>
        )}
      </button>
    </>
  )
}
