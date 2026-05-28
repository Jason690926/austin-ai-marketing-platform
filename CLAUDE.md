# CLAUDE.md

給未來 Claude Code 工作階段的專案指南。請先讀本檔再動工。

## 專案是什麼

**austin-ai-marketing-platform** — 內部行銷工具，幫各地經銷商統一管理 Facebook Page 發文，確保品牌一致性。Next.js 14 + shadcn/ui + Supabase + Gemini。

⚠️ 與 GitHub 上的 `Jason690926/ai-marketing-platform` 是**兩個不同專案**，只是早期共用 git 歷史（到 commit `418b7c4`）。不要把那邊的 commit 合併進來。origin 應指向 `austin-ai-marketing-platform`。

## 服務的兩個品牌（依 `store` 維度切換）

| `store` | 品牌 | 重點 |
|---|---|---|
| `mattress` | **Sleeptrain 美國席樂頓名床** | 定位「來自美國加州的奢華」，**美國品牌血統但台灣廠製造** — 絕不可寫「美國製造/原裝進口/Made in USA」 |
| `bedding` | **AUSTIN HOME 奧斯汀寢飾** | 1960 創立台灣寢具品牌，標語「睡得好，生活更美好」，代理 PEANUTS(Snoopy)/Classic Teddy/AZING |

品牌知識的唯一真實來源：`lib/prompts/brand-knowledge.ts`。**嚴禁出現 Musterring / 美得麗 / 圓山飯店**（初始 scaffold 的錯誤殘留）。資料不足處不得杜撰，要向使用者確認。

## 技術棧 / 重要路徑

- Next.js 14 App Router、TypeScript、Tailwind、shadcn/ui（`components/ui`）
- 認證/DB：Supabase（`@supabase/ssr`，`lib/supabase/{client,server}.ts`，`middleware.ts` 守衛）
- AI 文案：Gemini 2.5 Flash（`lib/gemini/client.ts`，模型可用 `GEMINI_COPY_MODEL` 覆寫）
- AI 產圖：Gemini 2.5 Flash Image / Nano Banana（`lib/gemini/image.ts`，模型可用 `GEMINI_IMAGE_MODEL` 覆寫升 3.1 Flash / 3 Pro）+ `sharp` 後端裁縮到精確 pixel
- 型別集中於 `types/index.ts`
- Prompt：
  - `lib/prompts/copywriter.ts` — 文案師人格 + `PURPOSE_GUIDE` + `buildCopyBrief`
  - `lib/prompts/brand-knowledge.ts` — 兩品牌知識 + 大小寫鐵律
  - `lib/prompts/scene-templates.ts` — 圖片生成 prompt 中樞：5 個場景模板 + `buildPrompt`(L1/L2) + `buildLevel3Prompt`(L3) + 品牌專屬 aesthetic anchors + 人物/道具/字型 direction + Lifestyle archetypes + outpaint helper
- Copy 邏輯：
  - `lib/copy/campaigns.ts` — 全年 27 個行銷檔期 + 智能排序
  - `lib/copy/parse-sections.ts` — 解析【區塊名】結構化輸出
- Sheets 整合（Meta 廣告推送）：
  - `lib/sheets/client.ts` — Service Account 認證 + col 字母轉換
  - `app/api/sheets/push-meta-ad/route.ts` — frame 偵測 / 複製 / smart skip / 寫入
- Meta 自動發文（發貼文到 FB Page）：
  - `lib/meta/client.ts` — Graph API client，發圖文貼文到 `/{page-id}/photos`
  - `app/api/posts/publish/route.ts` — 扇出發布 + 失敗重試 + 寫 posts 表
- AI 產圖（Level 1/2/3）：
  - `lib/gemini/image.ts` — Gemini 2.5 Flash Image REST client（raw fetch，獨立於文案 SDK，可用 `GEMINI_IMAGE_MODEL` 覆寫；支援 aspectRatio + 最多 3 張參考圖；**內建 retry 機制**：MALFORMED_FUNCTION_CALL / OTHER 重試最多 3 次指數退避）
  - `lib/prompts/scene-templates.ts` — `buildPrompt`(Level 1/2) / `buildLevel3Prompt`(Level 3) + `planLevel3Variations`；含品牌專屬 `BRAND_AESTHETIC_ANCHORS`(寢飾走 Kinfolk/MUJI、床墊走 Wallpaper*/Mandarin Oriental)、`HUMAN_DIRECTION`(禁 stock 笑容)、`INTERIOR_PROP_DIRECTION`(禁 IKEA)、`TYPOGRAPHY_DIRECTION`、`QUALITY_FAILSAFE`、`LIFESTYLE_ARCHETYPES_BY_STORE`(品牌專屬 6 個 editorial archetypes)、`buildOutpaintNote`(ref 比例 ≠ 輸出比例自動 inject)
  - `app/api/generate/image/route.ts` — multipart 接 level/mode/store/sizes/customSize/adContent/productBrief/catalogCount/lifestyleCount + 商品圖/參考圖；每 target 並行(`Promise.all`);用 **sharp** 量參考圖比例算 outpaint + 對所有輸出 cover fit 裁到精確 pixel(連 preset 也走 sharp)
- API：
  - `app/api/generate/copy/route.ts` — Gemini 文案產生
  - `app/api/generate/image/route.ts` — 三 Level AI 產圖
  - `app/api/sheets/push-meta-ad/route.ts` — Meta 廣告 → Google Sheet
  - `app/api/posts/publish/route.ts` — 文案 + 圖 → 發到 FB Page
- 頁面：`app/generator/{image,copy}`、`app/library`（素材庫）、`app/publish`（發布貼文）、`app/posts`（發文紀錄）、`app/login`
- DB：`supabase/migrations/*.sql`；`supabase/setup.sql` 為 001+002+004 合併的一次性建置（migration 003 加 DELETE RLS 政策、004 加 google_search_ad / pmax_ad purpose、005 加 posts 表、006 加 `generated-images` storage bucket + RLS）

## 開發流程

```bash
npm run dev          # localhost:3000，讀 .env.local
npx tsc --noEmit     # 型別檢查（每次改完跑）
```

- `.env.local`（被 .gitignore 排除）需要：Supabase URL/anon/service_role、`GEMINI_API_KEY`、Sheets 用 `GOOGLE_SHEETS_SA_JSON`、自動發文用 `META_PAGE_ID`/`META_PAGE_NAME`/`META_PAGE_ACCESS_TOKEN`。範本見 `.env.local.example`。
- **改 `.env.local` 後必須重啟 dev server**（Next 不會熱載入 env）。
- Supabase 是雲端**獨立帳號**新開的 project（免費版每帳號 2 project 上限，原帳號已滿）。DB schema 變更要使用者自行到 Supabase SQL Editor 跑對應 migration（無 CLI）。
- 沒裝 Docker、此工作階段無系統管理員權限。

## 慣例 / 規則

- **一律繁體中文（台灣用語）** 回覆使用者；程式碼/指令/專有名詞可原文。
- **金鑰安全**：不要叫使用者把 service_role / API key 貼進對話；請他自己填 `.env.local`，不要 Read 該檔內容。
- 專案擁有者是 Austin，使用者代為開發且**全權做主** — 不要提醒「與 Austin 確認」。
- 不擅自 commit / push；使用者要求才做。

## 目前狀態（2026-05-28）

已可運作：
- 真實 Supabase 登入
- `/api/generate/copy`：Gemini 文案，**8 種 purpose**（Meta 廣告 / Google 搜尋廣告 RSA / Google 多素材廣告 PMax·Demand Gen·Display / FB 貼文 / IG 貼文 / 品牌故事 / 商品介紹 / SEO·AEO·GEO）
- `/api/generate/image`：**Gemini 圖像產出 — 3 個 Level**：
  - **Level 1 底圖**：3 模式（場景模板 / 參考圖 / 自由描述），無文字、留白給後製
  - **Level 2 完整廣告**：使用者填 4 欄位（主標 / 副標 / 背書 / 賣點 ×3），AI 把文字燒進圖
  - **Level 3 AI 全權自主**：使用者只給商品 brief + catalog/lifestyle 變體數，AI 自己想場景、寫文案、設計版面；6 個 brand-specific lifestyle archetypes 自動輪替（寢飾走 Kinfolk / MUJI，床墊走 Wallpaper* / Mandarin Oriental）
  - **商品圖**（全 Level 適用）：上傳實際商品照→AI 保留商品原樣只重生背景
  - **參考圖**（reference 模式）：上傳場景參考；ref 比例 ≠ 輸出比例時後端用 sharp 量比例自動加 outpaint 指令
  - **6 種預設尺寸 + 自訂像素**（256-4096 整數），所有輸出 sharp cover 裁到精確 pixel
  - 圖檔上 Supabase Storage `generated-images` bucket（用 user_id 分資料夾走 RLS）
  - 自動寫入素材庫；商品圖優先存 `assets.reference_image_url`
  - 結果區每張有「下載」鈕（fetch as blob 繞跨網域）+「素材庫」連結
  - **重試機制**：Gemini 偶發 `MALFORMED_FUNCTION_CALL` / `OTHER` finishReason → 最多重試 3 次（指數退避 500ms→2000ms）
  - **預設模型** `gemini-2.5-flash-image`（standard 級中文字渲染弱），建議 `.env.local` 加 `GEMINI_IMAGE_MODEL=gemini-3.1-flash-image-preview`（4K、advanced 級、$0.045/張）
- 文案產生器 UI：
  - 用途卡片分群（社群 / 廣告 / 官網·SEO）
  - **行銷檔期 chip**（年度 27 個檔期，依當月智能排序，分節日/百貨/季節 3 色）
  - **主關鍵字** 欄位（廣告 / SEO 顯示）
  - **CTA 類型** 4 卡片（電商 / 來電 / 來店 / 其他，僅 Meta 廣告）
  - 結果區塊化顯示 + 每區獨立複製
  - **產生結果可內嵌編輯**（「編輯」鈕 → textarea 自由增刪文字 → 儲存同步更新 Supabase 素材庫；結構化用途依新文字重新分區）
  - **Meta 廣告 → Google Sheet 一鍵推送**（含 frame 複製、orphan smart skip、主標題二選一 radio、字數限制 25/30、frame 狀態 debug）
- `/library` 素材庫：**月份 dashboard 兩層**（tier 1 月份資訊卡含類型/品牌/熱門用途；tier 2 進入月份後篩選 + grid）
- **自動發文**（側邊欄「自動發文」分群）：
  - `/publish` 發布貼文：挑文案（產生器帶入 / 素材庫挑選）+ 上傳圖 + 勾選 Page → 一鍵發到 FB Page
  - `/posts` 發文紀錄：每發一個 Page 一列,顯示成功/失敗 + Meta 連結 + 錯誤訊息
  - 失敗處理：逐家發、成功略過失敗、跑完重試失敗清單第 2 次、再失敗則停並標紅等人工
  - 單一 Page 階段：Page 憑證由 `.env.local` 提供;已實測發文成功（測試粉專 AZING HOME）
  - ⚠️ 2026-05-22 開發者帳號一度被 Meta 風控凍結（連帶 token 失效、貼文隱形），解封後全部恢復;詳見記憶 `project_meta_account_flag_incident`

待辦：#4 FB Pages 管理（多經銷商 token DB 表）、#5 排程 UI。

#2 AI 產圖 Level 1-3 全套：2026-05-26 完成（單日從 0 → Level 1/2/3 全到位 + 商品圖 + 自訂像素 + 下載 + 品牌專屬美學）。模型用 Gemini 2.5 Flash Image (Nano Banana)，非規格原訂的 Imagen — Imagen 4 沒免費層且純 T2I 無法吃參考圖。

### 已知問題（下一步要處理）

- **中文字渲染品質**：`gemini-2.5-flash-image` (standard 級) 中文字常錯字 / 變形，6 字內較穩、超過 12 字就崩。建議升 `gemini-3.1-flash-image-preview`（advanced 級，付費 $0.045/張）。終極解法可能要走「AI 留位 + 後端字體渲染器疊字」混合方案。
- **Lifestyle 圖偶爾仍 stock photo 感**：已 prompt 強化（HUMAN_DIRECTION + 6 個 brand-specific editorial archetypes，明列「不對鏡頭笑」「individual characterful faces」），但 model 限制下偶爾仍出現「亞洲新婚夫妻」trope。若仍不夠 editorial，下一步要嘛升 3 Pro，要嘛在 archetype 加更具體 model casting 描述。

### 已修問題

1. **參考圖文案品質差**（2026-05-22 修）：上傳聯名角色圖（如 SNOOPY）時，文案只講品牌、忽略圖中主角。修法：`copywriter.ts` 系統 prompt 新增「參考圖片判讀規則」段（辨識主角→寫成文案主軸→氛圍只當輔助→不杜撰）；`route.ts` 參考圖指令從單行「參考氛圍/光線/色調」改為 5 點強指令；`copy-tab.tsx` 上傳欄說明同步更新。

### 改動歷程（2026-05-20 ~ 05-26）

**第九輪:AI 產圖完整三 Level 系統(2026-05-26 一日狂飆)**

單日把 #2「AI 產圖」從 0 → 完整可用,跨 7 次迭代。歷程重點(細節見各 commit / 程式碼,這裡只記決策與踩過的雷):

1. **模型選型**:原規格 Imagen 3 換成 **Gemini 2.5 Flash Image (Nano Banana)** — Imagen 4 系列無免費層且純 T2I 無法吃參考圖;Gemini 系列原生支援最多 3 張參考圖。可用 `GEMINI_IMAGE_MODEL` 覆寫升 3.1 ($0.045) / 3 Pro ($0.134)。
2. **基礎串接**:`lib/gemini/image.ts`(raw fetch,避免升 `@google/genai` SDK 影響文案路徑) + `app/api/generate/image/route.ts`(multipart, Promise.all 並行) + `components/generator/image-tab.tsx` UI 串好 + `supabase/migrations/006_create_storage_bucket.sql`(public bucket + 路徑前綴 RLS)。
3. **aspectRatio 欄位 bug**:第一次 1200x675 失敗回 400,我原本用 `responseFormat.image.aspectRatio` 是錯欄位,正解是 `imageConfig.aspectRatio`。
4. **商品圖 vs 參考圖** 拆成兩個概念:商品圖(全 Level 適用,model 第 1 張 ref,鐵律保留商品本身不變只重生背景)/ 參考圖(reference 模式,model 第 2 張 ref,定構圖氛圍)。
5. **下載 + 自訂像素**:下載用 fetch as blob 觸發(繞 Supabase 跨網域 download 限制);自訂尺寸 256-4096,後端用 `closestSupportedRatio` 算最接近的 Gemini 支援比例 → 餵 model → **裝 sharp,所有輸出 cover fit 裁到精確 pixel**(連 preset 也走 sharp,不再是 1024 近似)。`AspectRatio` 型別擴充到 10 個 Gemini 支援值,移除不支援的 1.91:1。
6. **Level 2 完整廣告**:`AdContent` interface(主標/副標/背書/賣點×3),`buildTextRenderingBlock` 強制繁中、品牌字型調性(Sleeptrain=luxury serif / AUSTIN HOME=warm sans)、品牌大小寫鐵律、不可加沒輸入的字。Level 2 用 `LEVEL_2_NEGATIVE_PROMPT`(允許文字)取代原 `NEGATIVE_PROMPT`(禁文字)。
7. **Level 3 AI 全權自主**:`buildLevel3Prompt`(分 catalog / lifestyle 兩種變體),`planLevel3Variations` 把 catalogCount + lifestyleCount 展成 variation 列表。UI 加第 3 個 level 選項,選 Level 3 時隱藏 mode/scene/reference/freeform/style/Level 2 區塊(全 AI 自己決定),只顯示 brief textarea + 變體數計數器。每變體 × 每尺寸 = 一張圖(e.g. 3 變體 × 2 尺寸 = 6 張)。
8. **設計感像 canva → 品牌專屬 aesthetic anchor**:User 抱怨「場景廉價」,改寫 prompt 加 `BRAND_AESTHETIC_ANCHORS` (寢飾走 Kinfolk/MUJI/Apartamento/Schemata 路線;床墊走 Wallpaper*/Mandarin Oriental/Architectural Digest/Restoration Hardware 路線),`HUMAN_DIRECTION`(不對鏡頭、不互看、不齒笑、不 stock 新婚夫妻 trope、companionable silence),`INTERIOR_PROP_DIRECTION`(禁 IKEA、禁 blown-out windows、禁 model-home sterility),`TYPOGRAPHY_DIRECTION`(editorial 字型 only、禁 Canva 字、禁 drop-shadow),`QUALITY_FAILSAFE`(11 條禁區明列)。重寫 `LIFESTYLE_ARCHETYPES_BY_STORE` 為品牌專屬 6 個 archetype,每個內嵌 雜誌 reference + 年齡 + 視線方向 + wardrobe + 建築 + 道具 + 燈光 + 心境。aesthetic block 從 prompt 結尾移到 scene 前(優先吸收)。
9. **參考圖 1:1 → 16:9 輸出 outpaint**:後端用 `sharp().metadata()` 量參考圖實際 W×H → `closestSupportedRatio` 算字串 → 跟輸出比例比,不同時 inject `buildOutpaintNote`(明確告訴 model「ref 是 1:1、輸出 16:9,延伸場景到兩邊」)。
10. **MALFORMED_FUNCTION_CALL bug**:第 8 點長 prompt + `=== ... ===` 區隔 + dash bullets 觸發 Gemini 把 prompt 誤判為 function call 解析失敗(已知 Google flaky bug)。修法:(a) `generateImage` 包 retry,偵測 MALFORMED_FUNCTION_CALL / OTHER 重試最多 3 次(指數退避 500→2000ms);(b) prompt 結構從「JSON-array-like」改寫成 prose 段落,拿掉 `===` 與 dash bullets。

⚠️ 使用者需自行:
- (a) Supabase SQL Editor 跑 migration 006 建 bucket+RLS
- (b) `.env.local` 設 `GEMINI_API_KEY`(產圖免費 quota 實測為準,2.5 Flash Image 付費 $0.039/張)
- (c) 建議加 `GEMINI_IMAGE_MODEL=gemini-3.1-flash-image-preview` 升級中文字渲染品質

**第八輪：參考圖判讀修復 + 結果內嵌編輯（2026-05-22）**
- 修「參考圖文案品質差」：`copywriter.ts` 系統 prompt 加「參考圖片判讀規則」段、`route.ts` 參考圖指令改 5 點強指令、`copy-tab.tsx` 上傳欄說明更新（commit `6d36d89`）。
- 產生結果新增「編輯」鈕：`ResultDisplay` 加編輯模式,textarea 自由增刪文字,儲存時 client-side 寫回 `assets.copy_text`(同素材庫星號/刪除模式)(commit `f1492ea`)。
- Meta 開發者帳號被風控凍結事件(非程式問題,解封後恢復) — 詳見記憶。

**第一輪：scaffold 殘留清除**
- `copywriter.ts` `PURPOSE_GUIDE.web_brand` 移除「百年德國工藝」殘留。
- `scene-templates.ts` 移除寫死的 "Musterring mattress" 與「圓山飯店」描述；`buildPrompt` 新增 `store` 參數，產品名用 `{{PRODUCT}}` 佔位符依品牌動態替換。
- `copy-tab.tsx` placeholder 兩處 Musterring 殘留（圓山飯店 / 德國工藝）已清除。

**第二輪：人格重寫 + Google Ads 多類型支援**
- `buildCopywriterSystemPrompt` 改為「全渠道數位行銷文案策略專家」，涵蓋品牌策略 / 社群 / Meta 廣告 / Google Ads（RSA + PMax，含 CJK 雙位元字元規則 → 標題實際只能 15 中文字）/ SEO·AEO·GEO 全包。
- `AssetPurpose` 擴充：新增 `google_search_ad`、`pmax_ad`（原 `ad` 純化為 Meta）。
- `GenerateCopyRequest` 加 `keywords?: string`。
- `lib/copy/parse-sections.ts`（新）：解析【區塊名】內容格式，廣告 / SEO 用結構化輸出。
- `copy-tab.tsx`：purpose 卡片分群、結果結構化分區 + 獨立複製。
- `supabase/migrations/004_extend_ad_purposes.sql`：CHECK constraint 加新 purpose。
- 進一步把 RSA / PMax 改為「**請務必滿配**」（RSA 15 標題 + 4 說明；PMax/Demand Gen/Display 通用 15 短標 + 5 長標 + 5 說明 + 商家名稱 + CTA），給的是涵蓋三種廣告類型的最寬鬆數量 + 最嚴格字元，方便使用者投放時自行挑選。

**第三輪：行銷檔期 chip（取代情境場景）**
- `lib/copy/campaigns.ts`（新）：全年 27 個檔期（節日 / 百貨檔期 / 季節 3 類），含 `sortCampaignsByRelevance(currentMonth)` 智能排序。
- `GenerateCopyRequest` 加 `campaigns?: string[]`；`buildCopyBrief` 把選到的 campaign brief 拼進 prompt。
- `copy-tab.tsx`：移除原「情境場景」（`SCENE_TEMPLATES` 仍保留供圖片用），改為 `<CampaignPicker>` chip 多選 + 依當月+下月優先 + 其他可展開 + 色點分類。

**第四輪：素材庫月份 dashboard**
- `library-view.tsx` 重構為兩層：
  - **Tier 1（月份卡片）**：標題 + 總筆數 + ⭐ 數；三行資訊「類型 / 品牌 / 熱門用途」用 pill 顯示。`InfoRow` + `Pill` 內部小元件。
  - **Tier 2（月份內）**：breadcrumb 返回 + 既有 type / store / starred filter + grid。
- 不再顯示縮圖（使用者要求簡化）。

**第五輪：Meta 廣告 → Google Sheet 一鍵推送（含 frame 複製）**
- 加 `googleapis` 套件、`lib/sheets/client.ts`（Service Account 認證，讀 `GOOGLE_SHEETS_SA_JSON` / `META_AD_SHEET_ID` / `META_AD_SHEET_TAB`）。
- API `app/api/sheets/push-meta-ad/route.ts`：
  - 解析 Meta 廣告區塊 → 找 Sheet 第一個空 frame → 寫入。
  - **Frame 複製模式**：偵測 sheet metadata 的合併儲存格算出 frame 寬度，每推送一則就 `copyPaste` 整個原始 frame（含 labels / 格式 / merges）到新位置（**水平 stride**：原始 4 欄 + 1 欄 gap = 5 欄，frame 1=A, frame 2=F, frame 3=K...）。
  - **欄數自動擴充**：偵測到目標欄超過 sheet 現有欄數時自動 `appendDimension`。
  - **模糊標籤對應**：用 `startsWith` / `contains` 比對標籤（容錯字串差異）。
  - **無對應欄位跳過**：縣市 / 年齡 / 性別 / 興趣 / 網站連結 等不寫，避免覆蓋使用者手填值。
- 字數約束：主標題 ≤ 25 字、說明 ≤ 30 字（對齊內部 sheet 模板，比 Meta 官方更嚴）；超字 API 端二次 clip 加 …
- UI：`<ResultDisplay>` 在 `purpose === 'ad'` 時顯示「推送 Google Sheet」按鈕；推送後顯示寫入 frame / 欄位 / sheet 直連。
- ⚠️ 使用者需自行：Google Cloud 建專案 + 啟用 Sheets API + 建 Service Account 下載 JSON + Sheet 分享給 SA email + JSON 單行貼進 `.env.local`。Sheet ID `1ezd2-wjt8yCyPF6aQTeK5GOCPvEJgFeXfFfN5OQo0QU`（meta 分頁）已預設於 `.env.local.example`。

**第六輪：使用體驗 bug 修復（CTA / 主標題 / Description / frame）**
- **CTA 類型選擇器**：UI 加 4 卡片（電商 / 來電 / 來店 / 其他），預設電商；prompt 依類型限制 CTA 詞彙並要求輪替。`GenerateCopyRequest` 加 `ctaType?: CtaType`。
- **主標題二選一 radio**：當模型產出 2 個 Headlines（sheet 只能容納 1）時，推送鈕上方顯示 radio 選擇器；prompt 強制 Headline 1 + Headline 2 必出且角度差異化；偵測 regex 放寬為 `^headline/i`。API `headlineOverride` 參數覆寫預設 Headline 1。
- **Description 多元化**：避免老是「AUSTIN HOMEXXXX」開頭 — prompt 給 5 種切入角度（利益/優惠/信任/情境/痛點），**禁止以品牌名開頭**。
- **品牌大小寫鐵律**：`brand-knowledge.ts` + system prompt 雙重保險（SNOOPY / PEANUTS / AUSTIN HOME / AZING 全大寫；Sleeptrain 首字大寫；Classic Teddy 兩字首字大寫）。
- **內文分段 + emoji**：Meta Primary Text 強制 3-4 段、段間留空行、嵌入 3-5 個 emoji。
- **Frame 寬度偵測 bug 修正**：原本用「max endColumnIndex of merges with startCol<10」每推送一次就把新 frame 的合併算進來，frameWidth 越漲越大（最後變 stride 10 而非 5），造成 sheet 跳欄並產生「orphan 標籤欄」（P、Z、AJ、AT 有標籤但無值）。改為**迭代間隔偵測**：依 startCol 排序，遇 gap 立即停。
- **Smart skip — 重用 orphan 標籤**：偵測到目標 frame 已有 labels（從歷史 bug 殘留）時跳過 `copyPaste`，直接寫值 → 新推送會自動填補既有 orphan 空欄。
- Sheet UI 加 **「🗂 Frame 狀態」** 折疊面板，列出每個 frame 的 `hasLabels` / `valuesFound` / `occupied` 狀態，方便排查。

**第七輪：自動發文 — 發貼文到 FB Page（2026-05-21）**
- 需求經 grill 模式釐清：同一篇文 + 同一張圖扇出發 N 個 Page;先做總公司單一 Page,終極目標 30 經銷商。即時發、不需審核（總公司自產文）、圖手動上傳系統後直傳 Meta 不落地。
- `supabase/migrations/005_create_posts.sql`（新）：`posts` 表,每發一個 Page 一列。`asset_id` 用 `ON DELETE SET NULL` + 另存 `copy_text` 快照,素材刪除後紀錄仍存。
- `types/index.ts` 加 `Post`、`PublishStatus`、`PublishPageResult`。
- `lib/meta/client.ts`（新）：`getMetaPages()` 讀 env;`publishPhotoPost()` 用 multipart 把圖 binary 直傳 `POST /{page-id}/photos`。
- `app/api/posts/publish/route.ts`（新）：multipart 接 copyText/assetId/pageIds/image。Round 1 逐家發 → Round 2 重試失敗清單 → 寫 posts 表 → 回逐家結果。
- `app/publish` + `components/publish/publish-view.tsx`（新）：文案下拉（素材庫）+ 編輯區、上傳圖、Page 多選 checkbox、逐家結果顯示。
- `app/posts/page.tsx`（新）：發文紀錄列表（server component）。
- `app-shell.tsx` 側邊欄加「自動發文」分群;`copy-tab.tsx` 結果區 `fb_post`/`post` 加「發布貼文」鈕（帶 `?assetId=` 跳 `/publish`）;`app/page.tsx` 改 redirect 到 `/generator`（原為 Next 預設 starter）。
- `.env.local.example` 加 `META_PAGE_ID`/`META_PAGE_NAME`/`META_PAGE_ACCESS_TOKEN`。
- ⚠️ 使用者需自行：建 FB 測試粉專、建 Meta App（開發模式）、加「管理粉絲專頁的所有內容」使用案例、Graph API Explorer 取權限（pages_show_list/pages_read_engagement/pages_manage_posts）→ 換**永久 Page Token**（短期 User Token → 延伸成長期 → me/accounts 衍生出的 Page Token 不過期）。發文用的一定是 Page Token,不是 User Token（用 User Token 會回誤導性的 `(#200) publish_actions deprecated`）。

### 廣告類結構化輸出規格（提醒模型用）

`copywriter.ts` 規定 ad / google_search_ad / pmax_ad / seo_article 必須用「【區塊名】內容」格式輸出。各 purpose 對應的區塊名見 `PURPOSE_GUIDE` 與 system prompt 的「結構化輸出格式」段。`lib/copy/parse-sections.ts` `parseSections()` 依此切塊。

## 記憶

詳細專案脈絡見 `~/.claude/projects/.../memory/`（platform-spec、brand-identity、project-progress、two-separate-repos、project-ownership、feedback-language）。
