'use client'

import { useState, useRef } from 'react'
import { SCENE_TEMPLATES } from '@/lib/prompts/scene-templates'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PenLine, ImagePlus, X } from 'lucide-react'
import type { AssetStore, AssetPurpose } from '@/types'

const STORES: { value: AssetStore; label: string }[] = [
  { value: 'mattress', label: '床墊' },
  { value: 'bedding',  label: '寢具' },
]

const PURPOSES: { value: AssetPurpose; label: string; desc: string }[] = [
  { value: 'ad',          label: '廣告文案', desc: 'FB / IG 付費廣告' },
  { value: 'fb_post',     label: 'FB 貼文',  desc: 'Facebook Page 發文' },
  { value: 'post',        label: '社群貼文', desc: 'IG / FB 一般貼文' },
  { value: 'web_brand',   label: '品牌故事', desc: '官網品牌介紹'     },
  { value: 'web_product', label: '商品介紹', desc: '商品頁規格說明'   },
  { value: 'seo_article', label: 'SEO 文章', desc: '關鍵字優化長文'   },
]

const FREEFORM_SCENE_ID = 'freeform'

export function CopyTab() {
  const [store,        setStore]        = useState<AssetStore>('mattress')
  const [purpose,      setPurpose]      = useState<AssetPurpose>('post')
  const [sceneId,      setSceneId]      = useState<string | null>(null)
  const [sceneDesc,    setSceneDesc]    = useState('')
  const [instructions, setInstructions] = useState('')
  const [imageFile,    setImageFile]    = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isFreeformScene = sceneId === FREEFORM_SCENE_ID

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

  function handleSceneClick(id: string) {
    setSceneId(sceneId === id ? null : id)
    if (sceneId !== id) setSceneDesc('')
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
              <p className="text-xs mt-0.5">JPG、PNG、WEBP，最大 10MB</p>
            </div>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
      </div>

      {/* Purpose */}
      <div>
        <Label className="text-sm font-medium mb-2 block">文案用途</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PURPOSES.map(p => (
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

      {/* Scene context */}
      <div className="space-y-3">
        <Label className="text-sm font-medium block">
          情境場景
          <span className="font-normal text-muted-foreground ml-1">（選填，幫助 AI 對應圖片氛圍）</span>
        </Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SCENE_TEMPLATES.map(t => {
            const active = sceneId === t.id
            return (
              <button key={t.id} onClick={() => handleSceneClick(t.id)}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'}`}>
                <p className="font-medium text-sm">{t.name}</p>
                <p className={`text-xs mt-0.5 ${active ? 'opacity-70' : 'text-muted-foreground'}`}>{t.description}</p>
              </button>
            )
          })}

          {/* Freeform scene card */}
          <button onClick={() => handleSceneClick(FREEFORM_SCENE_ID)}
            className={`text-left p-3 rounded-lg border border-dashed transition-colors ${
              isFreeformScene
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'}`}>
            <p className="font-medium text-sm flex items-center gap-1.5"><PenLine size={13} />自由描述</p>
            <p className={`text-xs mt-0.5 ${isFreeformScene ? 'opacity-70' : 'text-muted-foreground'}`}>自行輸入情境描述</p>
          </button>
        </div>

        {/* Scene description textarea */}
        {isFreeformScene && (
          <Textarea
            placeholder="例：夜晚台北高樓景觀房、皮革床頭板、暖黃燈光、有圓山飯店背景..."
            value={sceneDesc}
            onChange={e => setSceneDesc(e.target.value)}
            rows={3}
          />
        )}
      </div>

      {/* Instructions */}
      <div>
        <Label className="text-sm font-medium mb-2 block">
          額外指示 <span className="font-normal text-muted-foreground">（選填）</span>
        </Label>
        <Textarea
          placeholder="例：語氣要活潑、強調德國工藝、加入限時優惠資訊、字數約 150 字..."
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          rows={3}
        />
      </div>

      <Button className="w-full" size="lg" disabled>
        產生文案（API 串接中）
      </Button>
    </div>
  )
}
