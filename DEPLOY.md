# 部署指南 — Google Cloud Run

> 給接手部署的同仁。App 跑在 Cloud Run（容器），資料層維持 Supabase（第三方，不搬）。

## 架構速覽

| 層 | 用什麼 | 部署影響 |
|---|---|---|
| App（Next.js 14） | **Cloud Run 容器** | 本指南主體 |
| 登入 / DB / 圖片儲存 | Supabase（雲端第三方） | 不搬，App 對外連線即可 |
| AI 文案 / 產圖 | Gemini API | 放環境變數 |
| 廣告推送 | Google Sheets API（Service Account） | 放環境變數 |
| 自動發文 | Meta Graph API | 放環境變數 |

容器化已就緒：`Dockerfile`(standalone, Debian, 非 root)、`.dockerignore`、`cloudbuild.yaml`、`next.config.js` 已設 `output: 'standalone'`。

---

## 一、前置（GCP 管理員 / IT）

### 1. 專案與區域
- 用現有或新建 GCP 專案，記下 `PROJECT_ID`
- 建議 region：`asia-east1`（台灣）或 `asia-northeast1`（東京）

### 2. 啟用 API
```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com
```

### 3. 部署者需要的 IAM 角色
- `roles/run.admin`（部署 Cloud Run）
- `roles/artifactregistry.admin`（推 image；或 writer）
- `roles/cloudbuild.builds.editor`（用 Cloud Build）
- `roles/iam.serviceAccountUser`（以服務帳號部署）
- `roles/secretmanager.admin`（管理金鑰；若用 Secret Manager）

---

## 二、環境變數清單

| 變數 | 階段 | 機密? | 說明 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **build** | 否 | ⚠️ 編進前端，build 時傳入 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **build** | 否（公開值）| ⚠️ 同上 |
| `SUPABASE_SERVICE_ROLE_KEY` | runtime | **是** | 後端用，務必走 Secret Manager |
| `GEMINI_API_KEY` | runtime | **是** | 文案 + 產圖 |
| `GOOGLE_SHEETS_SA_JSON` | runtime | **是** | Service Account JSON（單行）|
| `META_AD_SHEET_ID` | runtime | 否 | 廣告試算表 ID |
| `META_AD_SHEET_TAB` | runtime | 否 | 分頁名 |
| `META_PAGE_ID` | runtime | 否 | FB 粉專 ID |
| `META_PAGE_NAME` | runtime | 否 | 粉專顯示名 |
| `META_PAGE_ACCESS_TOKEN` | runtime | **是** | 發文 Page Token |
| `GEMINI_IMAGE_MODEL` / `_PRO` / `GEMINI_COPY_MODEL` | runtime | 否 | 選用，覆寫模型 |

> **最重要的陷阱**：`NEXT_PUBLIC_*` 兩個變數必須在 **build 階段**就存在（會固化進前端 bundle），只在 Cloud Run runtime 設定**無效**。本專案已在 `Dockerfile` + `cloudbuild.yaml` 用 build-arg 處理。

### 把機密放進 Secret Manager（建議）
```bash
echo -n "你的值" | gcloud secrets create SUPABASE_SERVICE_ROLE_KEY --data-file=-
echo -n "你的值" | gcloud secrets create GEMINI_API_KEY --data-file=-
echo -n "你的值" | gcloud secrets create META_PAGE_ACCESS_TOKEN --data-file=-
# GOOGLE_SHEETS_SA_JSON 同理(單行 JSON)
```
並給 Cloud Run 的 runtime 服務帳號 `roles/secretmanager.secretAccessor`。

---

## 三、部署步驟

### 1. 建 Artifact Registry（一次）
```bash
gcloud artifacts repositories create austin-marketing \
  --repository-format=docker --location=asia-east1
```

### 2. Build + Push（用 Cloud Build，免本機 Docker）
```bash
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_IMAGE=asia-east1-docker.pkg.dev/PROJECT_ID/austin-marketing/app:latest,_SUPABASE_URL=https://xxx.supabase.co,_SUPABASE_ANON_KEY=eyJhbGci...
```

### 3. 部署到 Cloud Run
```bash
gcloud run deploy austin-marketing \
  --image asia-east1-docker.pkg.dev/PROJECT_ID/austin-marketing/app:latest \
  --region asia-east1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 600 \
  --max-instances 5 \
  --min-instances 0 \
  --set-secrets "SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,META_PAGE_ACCESS_TOKEN=META_PAGE_ACCESS_TOKEN:latest,GOOGLE_SHEETS_SA_JSON=GOOGLE_SHEETS_SA_JSON:latest" \
  --set-env-vars "META_AD_SHEET_ID=...,META_AD_SHEET_TAB=...,META_PAGE_ID=...,META_PAGE_NAME=..."
```

#### 參數說明
| 參數 | 值 | 為什麼 |
|---|---|---|
| `--memory` | 2Gi | sharp 處理大圖 + 多張並行很吃記憶體 |
| `--timeout` | 600（10 分鐘）| 產圖（Level 3 多圖 + Pro thinking）可能很久；這正是選 Cloud Run 而非 Vercel 的主因 |
| `--cpu` | 2 | 並行產圖 + sharp |
| `--min-instances` | 0 | scale-to-zero 省錢；要免冷啟設 1（月費仍低）|
| `--allow-unauthenticated` | 開 | 全站已由 app 自己的 Supabase 登入（`middleware.ts`）守衛，不需再疊 GCP IAM 層（疊了反而擋住登入頁公開存取）|

---

## 四、部署後（必做）

1. 取得 Cloud Run 網址（形如 `https://austin-marketing-xxxx.a.run.app`）
2. **Supabase → Authentication → URL Configuration**：把該網址加進 **Site URL** 與 **Redirect URLs**，否則登入導向會壞
3. 開網址測：登入 → 產圖（Level 2/3）→ 自動發文，三條主鏈路走一遍

### 自訂網域（選用）
Cloud Run → 網域對應，綁公司網域；綁好記得回 Supabase Auth URL 一併更新。

---

## 五、疑難排解

- **sharp 報錯找不到原生模組**：standalone 通常已 trace 進來；若 runtime 仍報錯，在 `Dockerfile` 的 runner 階段補一行
  `COPY --from=build /app/node_modules/sharp ./node_modules/sharp`（必要時連同 `@img/*`）。
- **產圖逾時被砍**：調高 `--timeout` 與 `--memory`。
- **登入後一直跳回登入頁 / 導向錯誤**：檢查第四節的 Supabase Auth URL 設定，以及 `NEXT_PUBLIC_*` 是否在 build 時正確傳入。
- **CI 自動部署**：可在 Cloud Build 設 trigger 連 GitHub repo，push 自動 build+deploy（用本專案 `cloudbuild.yaml` 再加一個 deploy step）。

---

## 六、本機開發不受影響

以上全部是部署用設定。本機開發照舊：`npm run dev`（localhost:3000，讀 `.env.local`）。`output: 'standalone'` 只在 `npm run build` 生效，不影響 `dev`。
