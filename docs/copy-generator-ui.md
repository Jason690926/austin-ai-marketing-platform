# 文案產生器 UI 架構（留存文件）

> 擷取時間：2026-05-19 ｜ commit 基準：`8535fcc` ｜ 路由：`/generator/copy`
> 狀態：UI 完成，後端 API 尚未串接（送出按鈕 `disabled`）

---

## 1. 架構總覽

```
/generator/copy  (Server Component, 驗證 + 版面)
└─ app/generator/copy/page.tsx
   ├─ Supabase getUser() → 未登入導向 /login
   ├─ logout (server action)
   └─ <AppShell user logoutAction>            ← components/layout/app-shell.tsx（共用側欄版面）
        └─ <CopyTab />                         ← components/generator/copy-tab.tsx（核心表單，Client）
             ├─ SCENE_TEMPLATES               ← lib/prompts/scene-templates.ts（場景資料）
             └─ 型別 AssetStore / AssetPurpose ← types/index.ts
```

**資料流：** 全部狀態在 `CopyTab` 內以 `useState` 管理（store / purpose / sceneId / sceneDesc / instructions / imageFile）。目前沒有送出邏輯——「產生文案」按鈕為 `disabled`，未來在此呼叫 `/api/generate/copy`（Gemini 2.5 Flash）。

**UI 區塊（由上而下）：**
1. 品牌 / 門市（床墊 / 寢具）
2. 參考圖片上傳（選填，AI 分析氛圍）
3. 文案用途（廣告 / FB 貼文 / 社群貼文 / 品牌故事 / 商品介紹 / SEO 文章）
4. 情境場景（5 個場景模板 + 自由描述卡）
5. 額外指示（選填）
6. 送出按鈕（目前停用）

---

## 2. 頁面包裝 `app/generator/copy/page.tsx`

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/app-shell'
import { CopyTab } from '@/components/generator/copy-tab'

export default async function CopyGeneratorPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  async function logout() {
    'use server'
    const supabase = createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <AppShell user={{ email: user.email! }} logoutAction={logout}>
      <div className="p-8 max-w-3xl">
        <h2 className="text-2xl font-bold mb-1">文案產生</h2>
        <p className="text-muted-foreground text-sm mb-8">使用 AI 撰寫品牌行銷文案</p>
        <CopyTab />
      </div>
    </AppShell>
  )
}
```

---

## 3. 核心表單 `components/generator/copy-tab.tsx`

```tsx
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
```

---

## 4. 共用版面 `components/layout/app-shell.tsx`

> 左側固定側欄（品牌名 + 導覽 + 使用者/登出），右側 `children` 為頁面內容。文案頁與圖片頁、素材庫共用同一殼。

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles, Images, LogOut, Image, FileText } from 'lucide-react'

const NAV = [
  {
    label: '素材產生器',
    icon: Sparkles,
    children: [
      { href: '/generator/image', label: '圖片產生', icon: Image },
      { href: '/generator/copy',  label: '文案產生', icon: FileText },
    ],
  },
  {
    label: '素材庫',
    icon: Images,
    href: '/library',
  },
]

interface AppShellProps {
  children: React.ReactNode
  user: { email: string }
  logoutAction: () => Promise<void>
}

export function AppShell({ children, user, logoutAction }: AppShellProps) {
  const pathname = usePathname()

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border flex flex-col">
        <div className="px-5 py-5 border-b border-border">
          <span className="font-bold text-base tracking-tight">AI 行銷平台</span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => {
            if ('children' in item && item.children) {
              const parentActive = item.children.some(c => pathname === c.href)
              return (
                <div key={item.label}>
                  <div className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium ${
                    parentActive ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    <item.icon size={15} />
                    {item.label}
                  </div>
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-3">
                    {item.children.map(child => {
                      const active = pathname === child.href
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                            active
                              ? 'bg-primary text-primary-foreground font-medium'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          }`}
                        >
                          <child.icon size={13} />
                          {child.label}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            }

            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <item.icon size={15} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut size={13} />
              登出
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
```

---

## 5. 相依型別 `types/index.ts`（文案產生相關）

```ts
export type AssetStore = 'mattress' | 'bedding'
export type AssetPurpose =
  | 'ad' | 'post' | 'web_brand' | 'web_product' | 'seo_article' | 'fb_post'

// 未來 /api/generate/copy 的請求合約（目前 UI 尚未呼叫）
export interface GenerateCopyRequest {
  store: AssetStore
  purpose: AssetPurpose
  sceneId?: string
  freeformDescription?: string
  additionalNotes?: string
}
```

---

## 6. 場景資料 `lib/prompts/scene-templates.ts`（CopyTab 只用到 `SCENE_TEMPLATES` 陣列）

> 注意：`buildPrompt()` / `getSceneById()` 為「圖片產生」使用；文案頁只消費下方 5 筆模板的 `id / name / description`。

```ts
import type { SceneTemplate } from '@/types'

export const SCENE_TEMPLATES: SceneTemplate[] = [
  { id: 'hotel_suite',      name: '五星飯店套房', description: '高端暗色調，彷彿圓山飯店的皇室感' },
  { id: 'cozy_family',      name: '溫馨家庭臥室', description: '明亮暖色調，新婚夫妻首選清晨感' },
  { id: 'japanese_minimal', name: '日式簡約禪意', description: '柔和中性調，清雅無印風' },
  { id: 'outdoor_nature',   name: '戶外自然草地', description: '清新明亮，夏日戶外活力感' },
  { id: 'studio_product',   name: '棚拍商品圖',   description: '純白背景，專業電商主圖用' },
  // 每筆另含 promptBody（英文 prompt），供圖片產生使用，文案頁未用到
]
```

---

## 7. 待辦（串接時）

- 「產生文案」按鈕移除 `disabled`，`onClick` 組出 `GenerateCopyRequest` → `POST /api/generate/copy`
- 後端用 **Gemini 2.5 Flash**（Google AI Studio 免費層），若有參考圖則走多模態分析氛圍
- 回傳文案存入 Supabase `assets`（`type='copy'`、`copy_text`）並導向素材庫
