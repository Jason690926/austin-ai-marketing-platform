# CLAUDE.md

給未來 Claude Code 工作階段的專案指南。請先讀本檔再動工。

## 專案是什麼

**austin-ai-marketing-platform** — 公司內部**多功能 AI 行銷工具**，主要給**行銷企劃同仁**使用：AI 自動產生文案 + AI 自動產生行銷圖片；自動發文到 Facebook Page（統一管理各地經銷商、確保品牌一致性）為其中一項功能。Next.js 14 + shadcn/ui + Supabase + Gemini。

⚠️ **定位（2026-06-25 重整）**：這不是「純發文工具」，而是行銷企劃日常用的產文/產圖平台。**上線分兩階段**：第一階段先讓內部同仁用「產文 + 產圖」（部署只需 Supabase + Gemini 金鑰即可上線）；第二階段再開放「自動發文」（補 Meta 金鑰 + #4 多經銷商 token）。部署面向見 `docs/IT部署操作手冊.md`（白話詳細版）+ `DEPLOY.md`（技術版）。

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
- AI 文案：Gemini 3.5 Flash（`lib/gemini/client.ts`，模型可用 `GEMINI_COPY_MODEL` 覆寫；2026-06-23 從淘汰的 2.5 Flash 升上來）
- AI 產圖：雙模型分流 — Level 1 底圖走 Nano Banana 2（`gemini-3.1-flash-image`），**Level 2/3 燒字用途自動走 Nano Banana Pro（`gemini-3-pro-image`，thinking 模式中文字保真度最高）**；分別可用 `GEMINI_IMAGE_MODEL` / `GEMINI_IMAGE_MODEL_PRO` 覆寫（`lib/gemini/image.ts`）+ `sharp` 後端裁縮到精確 pixel
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

## 目前狀態（2026-06-09）

已可運作：
- 真實 Supabase 登入
- `/api/generate/copy`：Gemini 文案，**8 種 purpose**（Meta 廣告 / Google 搜尋廣告 RSA / Google 多素材廣告 PMax·Demand Gen·Display / FB 貼文 / IG 貼文 / 品牌故事 / 商品介紹 / SEO·AEO·GEO）
  - **行銷大師語氣 persona**（7 種：品牌預設 / 精簡 / 幽默 / Ogilvy / Wieden+Kennedy / BBDO / Gary Halbert，全用途通用）
  - **受眾策略**（找新客 PAS 痛點+建立信任 vs 主顧再行銷 老友敘舊+破除回購猶豫；轉換型用途顯示）
  - **廣告合規護欄**（醫療/療效宣稱禁令 + 合規替代詞庫，兩品牌恆開；防螨抗菌等只能陳述產品特性、不得延伸療效）
  - **品牌名自然化 + 單一品牌一致性**：正文是否點名品牌依描述自然決定、不硬塞；house brand 一律寫「AUSTIN」或「奧斯汀」（**禁止 AUSTIN HOME**）；⚠️ 主打聯名角色（SNOOPY 等）時整篇只圍繞該角色、**AUSTIN/奧斯汀 100% 不出現**、絕不混搭（2026-06-09 使用者修正，鐵律寫進 `brand-knowledge.ts` + `copywriter.ts`）
  - **結構化輸出（廣告/SEO 走 Gemini responseSchema）**：`ad`/`google_search_ad`/`pmax_ad`/`seo_article` 改用 responseSchema 強制 JSON、滿配由 `minItems/maxItems` 鎖死，再用受控 serializer 序列化回標準【區塊名】文字存 `copy_text`（零 DB 改動、下游全相容）；字數超限用 `clipStructured` 智慧截斷兜底（切句界、保證 ≤ 上限）。見 `lib/copy/structured-output.ts`
- `/api/generate/image`：**Gemini 圖像產出 — 3 個 Level**：
  - **Level 1 底圖**：3 模式（場景模板 / 參考圖 / 自由描述），無文字、留白給後製
  - **Level 2 完整廣告**：使用者填 4 欄位（主標 / 副標 / 背書 / 賣點 ×3），AI 把文字燒進圖
  - **Level 3 AI 全權自主**：使用者只給商品 brief + catalog/lifestyle 變體數，AI 自己想場景、寫文案、設計版面；6 個 brand-specific lifestyle archetypes 自動輪替（寢飾走 Kinfolk / MUJI，床墊走 Wallpaper* / Mandarin Oriental）
  - **商品圖**（全 Level 適用）：上傳實際商品照→AI 保留商品原樣只重生背景
  - **參考圖**（reference 模式）：上傳場景參考；ref 比例 ≠ 輸出比例時後端用 sharp 量比例自動加 outpaint 指令
  - **創意尺度**（第三條視覺軸，全 Level 適用，預設寫實融入）：`realistic` 寫實融入（接地陰影/不漂浮）/ `playful` 巧思點綴 / `surreal` 超現實大膽（戲劇角度+高彩度+劇場光）。與「場景模式（構圖來源）」「風格調性（光線氛圍）」垂直。`playful/surreal` 會主動鬆綁品牌美學的 muted/quiet 鉗制讓大膽真的大膽；文字尺度也綁在此軸（realistic 只用 user 字，bold 允許補非宣稱氛圍字，但**價格/數字/認證/背書/療效跨模式恆禁**）。見 `lib/prompts/scene-templates.ts` `CREATIVE_SCALE_DIRECTION`
  - **6 種預設尺寸 + 自訂像素**（256-4096 整數），所有輸出 sharp cover 裁到精確 pixel
  - 圖檔上 Supabase Storage `generated-images` bucket（用 user_id 分資料夾走 RLS）
  - 自動寫入素材庫；商品圖優先存 `assets.reference_image_url`
  - 結果區每張有「下載」鈕（fetch as blob 繞跨網域）+「素材庫」連結
  - **重試機制**：Gemini 偶發 `MALFORMED_FUNCTION_CALL` / `OTHER` finishReason → 最多重試 3 次（指數退避 500ms→2000ms）
  - **雙模型分流（2026-06-23）**：Level 1 底圖（無文字）走 `gemini-3.1-flash-image`（Nano Banana 2，GA）省成本；**Level 2/3 燒字用途自動走 `gemini-3-pro-image`（Nano Banana Pro，GA）** — thinking 模式先規劃版面再渲染，中文字保真度遠勝 Flash。route 端 `burnsText = level==='level2'||'level3'` 決定，`generateImage` 收 `model?` 參數。可用 `GEMINI_IMAGE_MODEL`（底圖）/ `GEMINI_IMAGE_MODEL_PRO`（燒字，想全程省成本可降回 `gemini-3.1-flash-image`）分別覆寫。⚠️ 舊的 `-preview` ID 已棄用（`gemini-3-pro-image-preview` 2026-06-25 關閉），全面換 GA ID
- 文案產生器 UI：
  - 用途卡片分群（社群 / 廣告 / 官網·SEO）
  - **行銷檔期 chip**（年度 27 個檔期，依當月智能排序，分節日/百貨/季節 3 色）+ **自訂檔期描述欄位**（與 chip 並存）
  - **語氣風格 + 受眾策略選擇器**（見上方 purpose 說明）
  - **主關鍵字** 欄位（廣告 / SEO 顯示）
  - **CTA 導向** 4 卡片（電商 / 來電 / 來店 / 其他；Meta 廣告 + FB/IG 貼文 + 官網商品；選「來店」文案會導門市不導官網）
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

待辦：#4 FB Pages 管理（多經銷商 token DB 表）、#5 排程 UI。（**D Structured JSON Output 已於 2026-06-09 完成**，見第十三輪。）

#2 AI 產圖 Level 1-3 全套：2026-05-26 完成（單日從 0 → Level 1/2/3 全到位 + 商品圖 + 自訂像素 + 下載 + 品牌專屬美學）。模型用 Gemini 2.5 Flash Image (Nano Banana)，非規格原訂的 Imagen — Imagen 4 沒免費層且純 T2I 無法吃參考圖。

### 已知問題（下一步要處理）

- **中文字渲染品質**：~~`gemini-2.5-flash-image` 中文字常錯字 / 變形~~ → ~~2026-06-08 升 Nano Banana 2~~ → **2026-06-23 燒字的 Level 2/3 已路由到 Nano Banana Pro (`gemini-3-pro-image`)**，thinking 模式先規劃版面再渲染。**2026-06-24 實測 POC（後端疊字 vs Pro 直接燒字，含「謐/鬱/曦/榫卯/蠶/鑲嵌/櫸」極端罕字 + 極長句 + 5 賣點密集排版壓力測試）結論：Pro 渲染能力已非常強，連極端罕字長句都 ~95-100% 正確，「偶有瑕疵」基本是 Flash 時代殘留、Pro 上已大幅突破**。「AI 留位 + 後端字體疊字」混合方案經 POC 技術驗證可行（`@napi-rs/canvas` 載繁中字體 + `sharp` composite，文字 **100% 確定正確、任意長度/罕字不崩**），但其價值已從「修 Pro 錯字」轉為「**確定性 / 像素級可控 / 合規零風險 / 成本（底圖可走便宜 Flash）**」；代價是版面較模板化（字是平面層、藝術融合度弱於 Pro 把字融進場景）+ 需維護排版引擎與 OFL 字體授權。**評估後暫不整合（Pro 直接燒字已夠好），結論備查，需要 100% 精準/品牌一致/量產 banner 時再啟用**。POC 另發現 **Pro 會自作主張加未提供的文字（壓測時擅自加 AUSTIN 字樣）→ 合規地雷**，這是混合方案「只畫你給的字」的另一優勢。詳見記憶 `project_text_overlay_poc`。
- **Lifestyle 圖偶爾仍 stock photo 感**：已 prompt 強化（HUMAN_DIRECTION + 6 個 brand-specific editorial archetypes）；2026-06-23 Level 3 改走 Nano Banana Pro，指令遵循更強、可吃更細的 casting 描述，stock 感應減輕（待實測）。若仍不夠 editorial，下一步在 archetype 加更具體 model casting 描述，或餵多張 casting 參考圖（Pro 支援最多 14 張）。
- **創意尺度三段差異的結構性天花板**：第十四輪已把 prompt 改成具體變數 + 大膽模式鬆綁品牌鉗制，三段拉得開。但當「商品圖（尤其整房情境照）+ 場景描述 + 燒進去的文字」三者全被使用者鎖死時，三段能差的只剩相機/光線/彩度/staging。要差異更大需用「乾淨商品照」或讓場景留白給 AI。屬使用方式而非 bug，已記入 `docs/圖片產生器使用指南.md`。

### 已修問題

1. **參考圖文案品質差**（2026-05-22 修）：上傳聯名角色圖（如 SNOOPY）時，文案只講品牌、忽略圖中主角。修法：`copywriter.ts` 系統 prompt 新增「參考圖片判讀規則」段（辨識主角→寫成文案主軸→氛圍只當輔助→不杜撰）；`route.ts` 參考圖指令從單行「參考氛圍/光線/色調」改為 5 點強指令；`copy-tab.tsx` 上傳欄說明同步更新。

2. **RSA 結果不分卡**（2026-06-08 修，commit `7229168`）：Google 搜尋廣告（RSA）產出後不像 PMax 能逐區塊單獨複製，整篇變一塊純文字。根因：RSA 短區塊（15 標題等）模型常輸出「`【Headline 1】內容`」**同一行**，而 `parse-sections.ts` 舊正規表達式 `/^\s*【…】\s*$/gm` 要求標頭**獨佔一行** → 解析回 `[]` → `useStructured` 為 false → 退化成單一文字塊。修法：regex 改 `/^[ \t]*【([^】\n]+)】[ \t]*(.*)$/gm`，標頭後可選地接同行內容（group 2），content = 同行內容 + 後續換行內容。向下相容，已驗證 RSA 同行 / PMax 換行 / Ad 多行 Primary Text（含段落空行保留）三種格式皆正確。⚠️ 此 bug 正凸顯 parseSections 的脆弱性 → **已由待辦 D（Structured JSON Output / responseSchema）根治**（2026-06-09，見第十三輪）：寫入端改由受控 serializer 產出標準格式，解析脆弱在物理上不再發生。

### 改動歷程（2026-05-20 ~ 07-09）

**第十五輪：全面設計體檢 + 加固（2026-07-09）— 四路並行審查後修高/中優先**

四個審查代理並行體檢（權限/admin、核心 API、前端、DB/部署），安全底線確認紮實（後端驗證全覆蓋、RLS 擋提權、service_role 不洩前端），修掉以下設計問題：

1. **Migration 斷層（高）**：`users.role` 被 002 DROP 後 repo 一直沒補回（線上是手動 ALTER 的）→ 新增 `007_add_users_role.sql`（冪等）收編進版控；`setup.sql` 重生為 001–007 完整合併（原缺 003 DELETE 政策、005 posts、006 storage bucket，且仍有 DROP role）。
2. **雲端缺 Sheets env（高）**：`deploy.yml` 補 `GOOGLE_SHEETS_SA_JSON`（Secret Manager）+ `META_AD_SHEET_ID`（env var）— 原本 Cloud Run 上「推送 Google Sheet」必失敗。⚠️ push 前須先在 Secret Manager 建好該 secret，否則部署失敗。
3. **產圖 API 防護（高）**：sizes 去重 + 總量上限 `MAX_TARGETS=12` + 併發池（同時 3，取代裸 Promise.all）；`gemini/image.ts` retry 納入 429/5xx/timeout（429 用 4s/8s 長退避）+ fetch 加 120s `AbortSignal.timeout`；maxDuration 60→300 並註明 Cloud Run 實際由 `--timeout 600` 決定。
4. **copy-tab stale purpose（高）**：產生成功時快照 `resultMeta{purpose, campaignLabel}`，結果區改用快照渲染 — 原本產完後切換用途，舊結果會套新用途的按鈕（可把貼文誤推進廣告 Sheet）。
5. **發文重複防護（中）**：`meta/client.ts` 新增 `MetaPublishError`（retryable 分類）+ 60s timeout — **網路逾時屬曖昧狀態（貼文可能已送出）標 retryable=false，Round 2 不再自動重發**；只有 Meta 明確回暫時性錯誤碼（1/2/4/17/32/341）才重試，且先等 3 秒。publish route 加 10MB 圖片上限。前端 publish-view 發布成功後鎖表單，要再發須按「發布下一篇」明確重置。
6. **統計頁準確性（中）**：`/admin` 改 `fetchAll`（`.range()` 迴圈）突破 PostgREST 1000 列默默截斷；花費計算排除 `source='user_uploaded'` 與無 `image_level` 的列（原本被誤計 $0.039）。`/posts` 改用 service_role 讀全公司紀錄（原 RLS 只看得到自己發的，多 admin 互相看不到）+ limit 200。
7. **共用 `components/image-dropzone.tsx`（中）**：統一四處上傳區（copy-tab / image-tab 商品圖+參考圖 / publish-view）— 一致驗證（型別 + 大小；copy/publish 10MB、image-tab 5MB）、鍵盤可及（button 非 div）、dragleave 子元素閃爍修正、objectURL 統一回收。copy route 後端同步加 base64 14M 字元（≈10MB）上限。
8. 附帶：產圖 route 商品圖/參考圖上傳失敗補 `console.warn`（原靜默吞）；copy-tab 按鈕過時的「Gemini 2.5 Flash」字樣改為等待時間提示。

同日續修（低優先批次）：
9. **`/api/health`**：輕量健康檢查（回 200 + 關鍵 env 有無載入,不打外部服務）,middleware 放行免登入。
10. **部署可回滾**：image 同時打 `${{ github.sha }}`（不可變）+ `latest` 兩個 tag（`cloudbuild.yaml` 加 `_IMAGE_LATEST`）,Cloud Run 部署改用 SHA 版。
11. **`lib/constants.ts`**：TYPE/STORE/PURPOSE_LABEL 單一來源,library-view 與 publish-view 改 import（原兩份文字不一致）。
12. **兩份 parseSections 收攏**：sheets route 改包裝共用 `lib/copy/parse-sections`（寬鬆版為嚴格版超集）;順手刪掉死程式碼 `ensureEnoughColumns`。
13. **`/posts` 分頁**：searchParams `?page=`,每頁 50 筆 + 上下頁 + 總筆數。
14. **`008_lock_down_facebook_pages.sql`**：撤掉 `facebook_pages`（存 Page token!）與 `scheduled_posts` 的「任何登入者全開」RLS 政策 — 收緊後只剩 service_role 可存取,#4/#5 動工時再按需開;setup.sql 同步。
15. 微項：`lib/supabase/admin.ts` 加 `import 'server-only'` 硬防呆（新增該 dev 依賴）;admin users API 更新 0 列回 404;clipboard 加 try/catch（非 HTTPS 防呆）;`.env.local.example` 刪零引用的 R2_*/NEXT_PUBLIC_APP_URL;`shadcn` CLI 移 devDependencies。

驗證：`tsc --noEmit` ✓、45 測試 ✓、`npm run build` ✓（/api/health 已入 route 表）。剩餘未做：GCP 錯誤告警（使用者需在 Cloud Console 設 log-based alert）、editor 帳號實機驗證權限分級。⚠️ 使用者部署前置：Secret Manager 建 `GOOGLE_SHEETS_SA_JSON` + Supabase 跑 migration 007、008。

**第十四輪：AI 產圖「創意尺度」第三視覺軸（2026-06-09）— 討論定案 + plan + TDD + 實測迭代**

使用者實測 Level 2（SNOOPY 寢具 + 自由描述「足球場上」）產出「床漂浮在球場、無接地陰影、文字飄空中」的怪圖。經與使用者一輪產品討論釐清：問題不是「超現實」本身（超現實當創意成立），而是它是「意外的爛拼貼」非「故意的好超現實」；且系統無法從「足球場上」判斷使用者要寫實借勢還是大膽超現實 → 依專案判準（第十二輪「UI 只留給系統猜不到、選錯會錯的決策」）這是該給 UI 的決策。改動：

1. **新增 `CreativeScale` 第三條視覺軸**（`types/index.ts`）：`realistic`/`playful`/`surreal`，與「場景模式（構圖來源）」「風格調性（光線氛圍）」垂直、橫跨 Level 1/2/3、每次產圖各選、預設 realistic。`image-tab.tsx` 加 chip 選擇器（**放在 `level!=='level3'` 隱藏區塊外**，所有 Level 都顯示）；`route.ts` 解析 + 傳穿；`scene-templates.ts` `buildPrompt`/`buildLevel3Prompt` 注入。
2. **視覺手法 + 文字尺度綁同一軸**：realistic=接地寫實 + 只用 user 字;playful=寫實+一個巧思 + 允許非宣稱氛圍字;surreal=刻意超現實 + 允許非宣稱氛圍字。
3. **🚫 文字紅線跨所有模式恆禁**（合規）：AI 不可自生 價格/數字/認證/背書/店家數/療效。`TEXT_FACT_REDLINE` + `buildTextLibertyRules`。
4. **留白編排自動化**：Level 2 文字填太少 → 自動切極簡 editorial 版面（大留白、不捏字填版），所有模式都做。
5. **實測迭代（關鍵）**：第一版三段產出「幾乎一樣」。根因三個壓制源：(a) 商品圖+場景+文字鎖死 90% 畫面;(b) 創意尺度指令是抽象品質詞、非具體可畫變數 → 模型收斂;(c) 品牌 `BRAND_AESTHETIC_ANCHORS` 的「muted/quiet/never-exuberant」每張全力注入、跟 surreal 互斥。修法（使用者選「允許突破」）：指令改成**具體變數**（相機角度/光線/彩度/尺度）;playful/surreal 主動鬆綁品牌鉗制 —— 換較輕的 `QUALITY_FAILSAFE_BOLD`、注入 `BOLD_SCALE_AESTHETIC_OVERRIDE`（明令 Disregard muted）、negative prompt 用 `LEVEL_2_NEGATIVE_PROMPT_BOLD`（拿掉 no over-saturation）;realistic 維持完整品牌鐵律。
6. **TDD**：`scene-templates.test.ts`（43 個純層測試,重點鎖「文字紅線跨三模式恆禁」「大膽模式有鬆綁/寫實沒鬆綁」「具體變數」等不變式）。
7. **附帶**：新增 `docs/圖片產生器使用指南.md`（操作者速查每欄位意思 + 三軸心智模型 + 快速決策表）。

⚠️ 結構性天花板：商品圖（尤其整房情境照）+ 場景 + 燒字三者鎖死時,三段差異受限於相機/光線/彩度/staging;要更大差異需用乾淨商品照或讓場景留白。

**第十三輪：待辦 D 結構化 JSON 輸出 + 字數智慧截斷 + 品牌規則修正（2026-06-09）— TDD + 實測迭代**

完成待辦 **D（Structured JSON Output / responseSchema）**,並在實測中迭代出字數截斷與兩條品牌規則。全程走 plan → TDD（首次替專案引入 vitest）→ 實測。commit 拆兩個:`e163e42`（D 主體）、`a3eb5e0`（截斷 + 品牌）。

1. **D 結構化輸出**:廣告/SEO 四用途（`ad`/`google_search_ad`/`pmax_ad`/`seo_article`）改用 Gemini `responseSchema` 強制回傳 JSON,滿配（RSA 15 標題、PMax 15 短標+5 長標+5 說明）由 schema 的 `minItems/maxItems` 鎖死,取代原本「prompt 哀求滿配 + regex 事後猜」。
   - **核心架構決策:`copy_text` 仍是唯一真實來源、零 DB migration**。JSON 只是過程 → 我方用受控 serializer 序列化成標準格式的【區塊名】文字（標頭獨佔一行、區塊間空行）存 `copy_text`。下游全部不動照常運作（parseSections / sheets push 嚴格 regex / 素材庫 / 發布 / 內嵌編輯）。根治脆弱性的關鍵:寫入與讀取兩端都由我方掌握,RSA 那類「標頭與內容同行」的格式漂移在物理上不再發生。
   - 已驗證 SDK `@google/generative-ai` v0.24.1 原生支援 `responseMimeType`+`responseSchema`,**不需升級**。`ArraySchema` 有 `minItems/maxItems`（可鎖滿配）;`StringSchema` 無 `maxLength`（字數限制只能走 description + 後驗證）。
   - 新檔 `lib/copy/structured-output.ts`:`STRUCTURED_SCHEMAS` + `serializeSections` + `validateQuota`。`route.ts` 結構化用途分流（加 responseSchema → `JSON.parse` 包 try/catch 防禦退回 → 序列化）。`copywriter.ts` `buildCopyBrief` 結構化用途附 JSON 輸出說明。
2. **字數遵從 + 智慧截斷**:實測發現 Gemini 對「中文字數上限」天生當軟目標,RSA 說明常 49–53 字（上限 45）。兩段式處理:(a) schema 欄位 description + PURPOSE_GUIDE 強化「嚴格上限/逐字自檢/寧短勿長」措辭（只把 4 條全超降到 1–2 條輕微超）;(b) route 端序列化前用 `clipStructured` 智慧截斷兜底 —— 切在上限內最後一個標點,**連接性標點（逗號/頓號）結尾去尾收乾淨、句末標點（。！？）保留**,標點太早則硬切到上限。`validateQuota` 仍跑在模型原始輸出上以 log 診斷 overshoot。
3. **品牌規則修正（使用者實測指正）**:
   - **AUSTIN HOME 全面改 AUSTIN / 奧斯汀**:house brand 一律寫「AUSTIN」（全大寫）或中文「奧斯汀」,**禁止「AUSTIN HOME」**。改 `brand-knowledge.ts`、`copywriter.ts`（BRAND_NAME / 大小寫鐵律 / 廣告 Description 禁開頭清單 / 品牌名時機段）、`scene-templates.ts`（圖片品牌字樣）。
   - **單一品牌一致性鐵律**:一篇文案只能有一個品牌識別,主打聯名角色（SNOOPY/PEANUTS/Classic Teddy/AZING/Austin LONDON）時整篇（正文+標題+Description+hashtag+署名）**只圍繞該角色,AUSTIN/奧斯汀 100% 不可出現,絕不混搭**。寫進 `brand-knowledge.ts` + `copywriter.ts`「品牌名稱出現時機 + 單一品牌一致性」段,含正反例。已實測驗證:SNOOPY 主題 RSA 零 AUSTIN 混搭。
4. **首次引入 vitest**:`package.json` 加 `test`/`test:watch`、`vitest.config.ts`（node env、`@` alias 對齊 tsconfig）。純解析/序列化層 **28 個測試**（含鎖死 RSA 修復的 parse-sections 回歸 + serialize round-trip + clip 截斷 + validateQuota）。LLM/UI/DB 層仍走 `tsc --noEmit` + dev server 手測。判準:TDD 只對純函式層有意義,LLM 呼叫非確定性不單元測試。

⚠️ 殘留:字數限制無法在 schema 硬鎖（StringSchema 無 maxLength）,靠 description + clip 兜底已可保證不超字;Gemini 偶爾仍少填陣列（minItems best-effort）→ validateQuota 警告非致命。

**第十二輪：社群貼文體驗強化 + CTA 導向開放（2026-06-08）— 實測迭代驅動**

接續第十一輪,使用者本機實測社群貼文後逐輪回饋,把 `fb_post` / `post`(IG) 的 `PURPOSE_GUIDE` 從「軟性建議」全面改寫為「硬規則」。問題與修法（每改一輪都 `npx tsc --noEmit` 通過、靠 dev server 熱重編即測）：

1. **排版擠成一坨**：第一版只加「空行分段」,模型理解成「3 大段長文字」。改為**兩層斷行**：一句一行（FB 每句 12–22 字 / IG 10–18 字、禁逗號串長句）+ 區塊間空行,並**在 prompt 內直接塞一個排版示意範例**讓模型照節奏走。
2. **沒 emoji**：改硬規則「必嵌入 4–6 個,貼合語意、放行末/鉤子/CTA」。
3. **太制式沒溫度**：加「口吻硬規則」,點名禁掉「精心設計/全面新上市/打造…的一夜」等 DM 文宣腔。
4. **鉤子被埋**：加「開場鉤子硬規則」— 第一行必須能單獨擋下滑動（痛點/畫面/懸念/提問四選一）,**明文禁天氣鋪陳/泛泛感嘆/品牌名開頭**。
5. **互動指標優化**（討論後決策：社群該對演算法看的「互動/停留/分享」優化,而非套無效的網頁 SEO）：加「互動設計硬規則」— 留言/標記分享/收藏/共鳴**四種觸發自動輪替**（掛在第十一輪的隨機機制上,自帶防雷同）+ hashtag 少而精；IG 另加輕量站內 SEO（首句自然帶 1 主關鍵字吃 IG caption 搜尋）。**決策：互動設計交系統自動處理、不加 UI**（判準：UI 只留給「系統猜不到、選錯會錯」的決策如 CTA；互動觸發屬通用好做法、要的是變化不是控制）。
6. **CTA 導向**（這個反而**該加 UI**）：原 CTA 選擇器（電商/來電/來店/其他）只在 Meta 廣告顯示 → 開放給 **FB 貼文 / IG 貼文 / 官網商品**（`copy-tab.tsx` `showCtaType`）；UI 文字「CTA 類型」→「CTA 導向」。`buildCopyBrief` CTA 指令**依用途分流**：廣告維持【CTA】區塊；社群/官網改自然融入結尾,且選「來店」明確禁止導官網下單。

關於 SEO/AEO/GEO 的釐清（使用者問「社群貼文裡 SEO 在哪」）：社群貼文**刻意不做網頁式 SEO**（FB/IG 不被搜尋引擎索引,靠平台演算法）；真正的 SEO/AEO/GEO 在獨立的 `seo_article` 用途（輸出 H1/Meta Title/Slug/FAQ 等）。社群只做「站內被搜到」的輕量版（hashtag + IG caption 關鍵字）。

commit 拆兩個：`db3d18c`（社群貼文體驗強化）、`834c1a4`（CTA 導向開放）。改動檔案：`lib/prompts/copywriter.ts`、`components/generator/copy-tab.tsx`。

續修（同日，社群貼文持續優化）：
7. **「不做 CTA」純內容選項**：`CtaType` 加 `'none'`；CTA 導向 UI 在 FB/IG 貼文多一張「不做 CTA」卡（廣告/官網商品不給，含切換時 reset 守衛）；`buildCopyBrief` 選 none 時禁止任何銷售/轉換呼籲、改走品牌經營/情感共鳴，**但仍保留一個互動觸發點**（不做 CTA ≠ 不做互動）。
8. **emoji 位置自然化**：原 emoji 規則 + 排版示意範例都把 emoji 放行末 → 模型學成「清一色貼行末」。改規則為「位置要變化（句首/句中/句末/單獨成行）、不要每個都貼行末」，並把 FB/IG 兩個排版示意範例重寫成 emoji 散落各處（根因：範例怎麼示範模型就怎麼學）。
改動檔案：`types/index.ts`、`components/generator/copy-tab.tsx`、`lib/prompts/copywriter.ts`。

**第十一輪：模型升級 + 文案變化機制（2026-06-08）**

查證 2026-06 各 AI 線最新版本後執行兩項優化：
1. **產圖升 Nano Banana 2**：`lib/gemini/image.ts` 預設 `gemini-2.5-flash-image` → `gemini-3.1-flash-image-preview`（2026-02 GA，中文字渲染大幅改善，直接解掉「已知問題」第一條）。仍可用 `GEMINI_IMAGE_MODEL` 覆寫降級/升 Pro。同步更新 `.env.local.example`、`image-tab.tsx` 說明、CLAUDE.md。
2. **文案變化機制（解雷同，留在 2.5 Flash）**：雷同主因是「相同輸入→模型走同一條安全路徑」，光調 temperature 只變用字不變套路。兩段式解法：(a) `copywriter.ts` 新增 `pickVariationDirective()` — 每次產出隨機抽 1 個切入角度（10 選 1：痛點/場景/反差/感官/提問/故事/數據/直球/借勢/私語）+ 2 條開場禁令（5 池輪替），注入 `buildCopyBrief`；對結構化用途只影響鉤子/用字、不破壞【區塊】格式。(b) `route.ts` 加 `generationConfig` temperature 1.2 / topP 0.97 拉高發散度。文案模型維持 2.5 Flash，待驗證雷同改善後再評估是否升 3 Flash。`npx tsc --noEmit` 通過。

**環境稽核：skill-cleaner 體檢（2026-06-08）— 非程式改動**

使用者要求評估 `steipete/agent-scripts` 的 skill-cleaner。結論:原版綁 Codex（讀 `~/.codex/...`），不適用 Claude Code；改用社群移植版 [YuzuruS/claude-skill-cleaner](https://github.com/YuzuruS/claude-skill-cleaner)（MIT、唯讀只建議不刪）。clone 到 `%TEMP%` 跑 `node --experimental-strip-types scripts/skill-cleaner.ts --months 3`，跑完已刪除暫存。**體檢結果:環境乾淨** — `~/.claude/skills` 僅 4 個 personal skill（總 ~303 tokens）、無重複、無過時 plugin 版本、無自裝 subagent。唯一提示 `ui-ux-pro-max` description 807 字元（~207 tok），但那是刻意塞關鍵字以利自動觸發，**不動**。`test-driven-development` / `verification-before-completion` 被標近 3 月未明確呼叫（weak signal，仍會自動觸發），留著無害。此工具對「裝多 plugin/skill 堆積」的環境才有價值，對本機基本無事可做。內建 skill（code-review/deep-research 等）不在其稽核範圍。

**第十輪：文案產生器強化（2026-05-29）— 擷取外部文案器優點**

使用者提供一份外部文案產生器規格（`CreativeCopy AI`），擷取其優點優化本系統。經分析，採用其「語氣 persona / 受眾策略 / 合規護欄」三點（其餘如 RSA 規格、借勢檔期，本系統已更完整）。Structured JSON Output（responseSchema，可解掉「滿配驗證 + parseSections 解析脆弱」）價值最高但屬重構，留待之後單獨做（代號 D）。本輪實作：

1. **A 行銷大師語氣 persona**：`types.ts` 加 `ToneStyle`（7 種）；`copywriter.ts` `TONE_STYLE_GUIDE` 每 persona 一段具體寫作指令、`buildCopyBrief` 注入（`brand_default` 不覆寫）；`copy-tab.tsx` 卡片選擇器（全用途通用）。
2. **B 受眾策略**：`types.ts` 加 `AudienceStrategy`（new_customer / remarketing）；`copywriter.ts` `AUDIENCE_STRATEGY_GUIDE` 改變切入角度；UI 選擇器只在轉換型用途（ad/RSA/PMax/post/fb_post/web_product）顯示，含「不指定」。
3. **C 合規護欄**：`copywriter.ts` 系統 prompt 加「廣告合規護欄」段 — 禁治療/改善失眠、根治過敏、療效宣稱、矯正脊椎等；防螨抗菌只能陳述產品特性、不得延伸療效；提供合規替代詞庫。兩品牌恆開、無 UI。
4. **自訂行銷檔期欄位**：`types.ts` 加 `customCampaign?`；`buildCopyBrief` 把 chip 檔期 + 自訂檔期合併同段；`copy-tab.tsx` `CampaignPicker` 底部加 Input。
5. **品牌名自然化**：系統 prompt 加「品牌名稱出現時機」段 + 改寫參考圖判讀規則（原強推「品牌 × 角色」）+ `route.ts` 參考圖指令加第 5 點。正文依描述自然決定是否點名品牌、不硬塞，品牌識別優先 hashtag/署名；web_brand/web_product 例外。
6. **順手修矛盾**：原鐵律「禁用 #」與 seo_article 的【Article Body】要求 ## H2/### H3 衝突 → 明確標註 seo_article 例外。

實測（直連 Gemini 繞 auth 驗證，腳本用後即刪）：Gary Halbert+再行銷+床墊 → 語氣/受眾/防螨護欄全中、未寫 Made in USA；SNOOPY 情境 → 正文聚焦角色、AUSTIN 只在 hashtag。commit `65c9dde`，已推 origin。改動檔案：`types/index.ts`、`lib/prompts/copywriter.ts`、`components/generator/copy-tab.tsx`、`app/api/generate/copy/route.ts`。

⚠️ 待辦補充：**#5 排程 UI** 一度起頭即暫緩（使用者改先優化文案）；關鍵未決點 = 排程到期後「怎麼真的觸發發文」取決於部署環境（本機 npm run dev / Supabase pg_cron / Vercel Cron），且圖片需先落地 Storage。**D（Structured JSON Output）** 為下一個文案優化候選。

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
