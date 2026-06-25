# IT 部署操作手冊（白話版）

> 給協助部署的 IT 同仁。**不需要寫程式、不需要在自己電腦裝任何軟體**，全程在瀏覽器內完成。
> 照著步驟一步一步做即可；每一步都有「這步在做什麼」「怎麼做」「成功會看到什麼」。
> 遇到看不懂的指令，直接整段複製貼上就好。

---

## 0. 這個系統是什麼（先有概念）

**austin-ai-marketing-platform** 是一套公司內部的 **AI 行銷工具網站**，主要給**行銷企劃同仁**使用，功能包含：

- 🖊️ **AI 自動產生文案**（廣告、社群貼文、SEO 文章等）
- 🎨 **AI 自動產生行銷圖片**（含把文字燒進圖的完整廣告稿）
- 📤 **（後續階段才開放）自動發布貼文到 Facebook 粉專**

**上線分兩階段：**

| 階段 | 開放內容 | 本次部署範圍 |
|---|---|---|
| **第一階段（現在）** | 內部同仁使用「AI 產文 + AI 產圖」 | ✅ **本次要做的就是這個** |
| 第二階段（之後） | 開放「自動發文到經銷商粉專」 | ⏳ 之後再補設定，不影響本次 |

> 所以本次部署**只要讓網站能登入、能產文、能產圖**就算成功；發文功能的金鑰可以**先不設**，之後再加。

**系統架構（一句話）：** 網站本體放到 Google 的 **Cloud Run**，資料（帳號、圖片）放在既有的 **Supabase**（第三方雲端服務，不用搬、不用管）。

---

## 1. 名詞先看懂（白話）

| 名詞 | 白話解釋 |
|---|---|
| **GCP / Google Cloud** | Google 的雲端平台，我們要把網站放上去 |
| **Cloud Run** | 一種「把網站丟上去就會自動跑、沒人用就自動休眠不收錢」的服務 |
| **容器（Container）** | 把整個網站打包成一個「隨處可跑的盒子」，本專案已經打包好設定，你不用懂內容 |
| **Cloud Shell** | Google 雲端提供的「網頁版終端機」，打開就能用，**不用在自己電腦裝任何東西** |
| **Artifact Registry** | 存放「容器盒子」的倉庫 |
| **Cloud Build** | 幫我們把程式碼「組裝成容器盒子」的工人 |
| **Secret Manager** | 安全保管密碼/金鑰的保險箱 |
| **Supabase** | 第三方服務，管帳號登入和存圖片，**已經在運作、本次不用動它的主機**，只需最後設定一個網址 |

---

## 2. 開始前要準備的東西

請先跟開發窗口（Jason）拿到以下資料，**建議用公司內部安全管道傳遞（不要用公開聊天室）**：

**A. 一定要的（第一階段內部使用就需要）**
- [ ] **Supabase 網址**（`NEXT_PUBLIC_SUPABASE_URL`，形如 `https://xxxx.supabase.co`）
- [ ] **Supabase 公開金鑰**（`NEXT_PUBLIC_SUPABASE_ANON_KEY`，一長串）
- [ ] **Supabase 服務金鑰**（`SUPABASE_SERVICE_ROLE_KEY`，機密）
- [ ] **Gemini API 金鑰**（`GEMINI_API_KEY`，機密，AI 產文+產圖用）

**B. 之後階段才需要（本次可先略過）**
- [ ] Google Sheets 服務帳號 JSON（`GOOGLE_SHEETS_SA_JSON`）＋ 試算表 ID — 廣告推送試算表功能用
- [ ] Meta 粉專相關（`META_PAGE_ID` / `META_PAGE_NAME` / `META_PAGE_ACCESS_TOKEN`）— 自動發文用

**C. 取得程式碼的方式（二選一）**
- 方式一：跟 Jason 要 GitHub 存取權，用網址 `https://github.com/Jason690926/austin-ai-marketing-platform.git` 下載
- 方式二：跟 Jason 要一個壓縮檔（zip），用 Cloud Shell 的「上傳」按鈕上傳

**D. 權限**
- [ ] 你的 Google 帳號需要對這個 GCP 專案有 **「擁有者（Owner）」或「編輯者（Editor）」** 權限。若沒有，請公司 GCP 管理員授予（這是唯一需要管理員幫忙的地方）。

---

## 3. 全部步驟（照順序做）

> 以下每個「```」框框內的指令，都是**整段複製 → 貼到 Cloud Shell → 按 Enter**。
> 凡是看到 **`要換成你的值`** 的地方，請先把它替換成第 2 節拿到的實際資料再執行。

### 步驟 1：打開 Cloud Shell（網頁終端機）

1. 用瀏覽器登入 [https://console.cloud.google.com](https://console.cloud.google.com)
2. 左上角確認/選擇正確的**專案**（如果還沒有專案，點上方專案下拉 → 新建專案 → 命名如 `austin-marketing` → 建立）
3. 點右上角那個 **`>_`** 圖示（「啟用 Cloud Shell」），畫面下方會跳出一個黑色終端機視窗
4. 第一次開會問「授權」，按 **授權 / Authorize**

✅ **成功的樣子**：下方出現黑色文字輸入區，開頭類似 `你的帳號@cloudshell:~$`

---

### 步驟 2：設定專案 + 開啟需要的功能

**這步在做什麼**：告訴系統「我們要在哪個專案做事」，並打開 4 個會用到的雲端功能。

先設定專案（把 `你的專案ID` 換成你的，例如 `austin-marketing-12345`）：
```bash
gcloud config set project 你的專案ID
```

再一次開啟 4 個 API：
```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com
```

✅ **成功的樣子**：跑完出現 `Operation ... finished successfully` 之類，沒有紅字 error。（這步可能跑 1～2 分鐘，請耐心等。）

⚠️ 若出現「需要啟用計費（billing）」：請到 Console 左側選單 →「計費」，把這個專案綁定公司的計費帳戶後再重跑。

---

### 步驟 3：把程式碼抓到 Cloud Shell

**方式一：用 GitHub（需先有存取權）**
```bash
git clone https://github.com/Jason690926/austin-ai-marketing-platform.git
cd austin-ai-marketing-platform
```

**方式二：用上傳的壓縮檔**
1. 點 Cloud Shell 視窗右上角的 **三個點 ⋮ → 上傳（Upload）**，選 Jason 給的 zip
2. 解壓並進入資料夾：
```bash
unzip austin-ai-marketing-platform.zip
cd austin-ai-marketing-platform
```

✅ **成功的樣子**：執行 `ls` 後，看到 `Dockerfile`、`cloudbuild.yaml`、`package.json` 等檔案，代表你在正確的資料夾裡。

---

### 步驟 4：把機密金鑰放進保險箱（Secret Manager）

**這步在做什麼**：把密碼類資料安全存起來，之後網站啟動時自動讀取，不會寫在程式裡。

> 這裡用**網頁操作**比較直覺（不用怕在終端機留下密碼）。

1. 瀏覽器另開分頁，到 Console 左側選單 →「**安全性 → Secret Manager**」（或搜尋 "Secret Manager"）
2. 點上方 **「+ 建立密鑰 / Create Secret」**，逐一建立以下密鑰：

| 密鑰名稱（名稱要一字不差） | 內容貼上 |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服務金鑰 |
| `GEMINI_API_KEY` | Gemini API 金鑰 |

   - 「名稱」填上表左欄、「密鑰值 / Secret value」貼上表右欄的實際值 → 按 **建立**
   - （之後階段要開發文/試算表時，再用同樣方式加 `META_PAGE_ACCESS_TOKEN`、`GOOGLE_SHEETS_SA_JSON`）

3. 回到 Cloud Shell，授權網站能讀取這些密鑰（整段貼上執行）：
```bash
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

✅ **成功的樣子**：Secret Manager 頁面列出 2 個密鑰；最後一段指令跑完沒有紅字。

---

### 步驟 5：建立容器倉庫（放打包好的網站）

**這步在做什麼**：開一個倉庫，等一下打包好的「網站盒子」會放這裡。

（把 `asia-east1` 維持或改成你要的區域；台灣建議 `asia-east1`，東京 `asia-northeast1`）
```bash
gcloud artifacts repositories create austin-marketing \
  --repository-format=docker \
  --location=asia-east1
```

✅ **成功的樣子**：出現 `Created repository [austin-marketing]`。
（若顯示「已存在」也沒關係，代表之前建過，可直接往下。）

---

### 步驟 6：打包網站成容器（Cloud Build）

**這步在做什麼**：把程式碼組裝成可執行的「網站盒子」並放進倉庫。這步會跑比較久（約 5～10 分鐘）。

⚠️ 重點：Supabase 的網址和公開金鑰必須在**這個打包階段**就放進去（會被編進網站），所以指令裡要帶。

把下面三個 `要換成你的值` 換好後，整段執行：
```bash
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=\
_IMAGE=asia-east1-docker.pkg.dev/$(gcloud config get-value project)/austin-marketing/app:latest,\
_SUPABASE_URL=要換成你的Supabase網址,\
_SUPABASE_ANON_KEY=要換成你的Supabase公開金鑰
```

> 小提醒：上面指令用 `\` 換行是為了好讀，整段一起複製貼上即可；三個值之間用逗號隔開、**逗號前後不要有空格**。

✅ **成功的樣子**：最後出現 `SUCCESS`，並顯示一個 image 路徑（`asia-east1-docker.pkg.dev/.../app:latest`）。

❌ 若出現紅字 `ERROR`：把整段訊息複製給 Jason 看，多半是某個值貼錯或少貼。

---

### 步驟 7：把網站正式上線（部署到 Cloud Run）

**這步在做什麼**：把剛打包好的網站正式啟動、給一個可以打開的網址。

整段執行（區域要和前面一致）：
```bash
gcloud run deploy austin-marketing \
  --image asia-east1-docker.pkg.dev/$(gcloud config get-value project)/austin-marketing/app:latest \
  --region asia-east1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 600 \
  --max-instances 5 \
  --min-instances 0 \
  --set-secrets "SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest"
```

> 說明：第一階段只放 Supabase 服務金鑰和 Gemini 金鑰兩個。之後要開發文功能時，再把 `META_PAGE_ACCESS_TOKEN` 等加進這串 `--set-secrets` 並重跑一次本步驟即可。

✅ **成功的樣子**：最後顯示
```
Service [austin-marketing] revision ... has been deployed and is serving 100 percent of traffic.
Service URL: https://austin-marketing-xxxxxxxx.a.run.app
```
👉 **把這個 `Service URL` 記下來，這就是網站網址。**

---

### 步驟 8：到 Supabase 設定登入網址（很重要，否則登入會壞）

**這步在做什麼**：告訴 Supabase「允許這個新網址來登入」。

1. 登入 [https://supabase.com](https://supabase.com) → 進入這個專案
2. 左側 **Authentication（驗證）→ URL Configuration**
3. 把步驟 7 拿到的網址（`https://austin-marketing-xxxxxxxx.a.run.app`）：
   - 填進 **Site URL**
   - 也加進 **Redirect URLs**（按 Add，貼上）
4. 儲存

> 這步需要 Supabase 後台權限，若 IT 沒有，請 Jason 完成這一步即可（30 秒）。

---

### 步驟 9：驗收（確認真的能用）

用瀏覽器打開步驟 7 的網址，依序測：

- [ ] 1. 出現**登入畫面** → 用測試帳號登入成功
- [ ] 2. 進入「文案產生器」→ 隨便產一篇 → **有出文案**
- [ ] 3. 進入「圖片產生器」→ 產一張圖 → **有出圖**（這項較久，等到 1 分鐘屬正常）

三項都過 = **第一階段內部上線完成！** 🎉
（發文功能屬第二階段，本次不驗收。）

---

## 4. 之後要更新網站版本怎麼做？

當 Jason 改了程式、要更新線上版本時，只要在 Cloud Shell 進到資料夾，重跑**步驟 6 + 步驟 7** 兩段即可（其他都不用重做）。約 10 分鐘完成更新。

---

## 5. 常見問題排解

| 狀況 | 怎麼辦 |
|---|---|
| 指令出現 `Permission denied` / 權限不足 | 你的帳號對專案權限不夠，請 GCP 管理員給「Owner 或 Editor」 |
| 出現要啟用 billing（計費） | Console →「計費」把專案綁公司計費帳戶 |
| 步驟 6 打包失敗 | 多半是 Supabase 兩個值貼錯/少貼，整段錯誤訊息給 Jason |
| 網站打得開但**登入後一直跳回登入頁** | 八成是步驟 8 沒設好，回去確認 Supabase 的 Site URL / Redirect URLs |
| 產圖時轉很久或失敗 | 正常情況產圖較久；若常失敗，回報 Jason 看 Gemini 金鑰額度 |
| 網址打不開 / 503 | 等 1 分鐘（休眠後第一次開機較慢），仍不行就把步驟 7 訊息給 Jason |

---

## 6. 費用說明（給主管參考）

- **Cloud Run**：沒人使用時自動休眠、**不計費**（scale-to-zero）；有人用才依秒計費，內部小流量月費極低。
- **主要成本是 AI 用量**：Gemini 產文/產圖依張數/字數計費，與部署無關，另行控管。
- 整體屬**用多少付多少**，無固定機器月租。

---

## 7. 給「只負責授權的 GCP 管理員」的精簡版

如果貴司是「IT 管理員只負責開權限、實際部署由他人做」，管理員只需做 2 件事：
1. 給部署者帳號該專案的 **Owner 或 Editor** 角色（或細項：Cloud Run 管理員、Artifact Registry 管理員、Cloud Build 編輯者、Service Account User、Secret Manager 管理員）
2. 確認專案已**綁定計費帳戶**

其餘照本手冊由部署者執行即可。完整技術指令另見 `DEPLOY.md`。
