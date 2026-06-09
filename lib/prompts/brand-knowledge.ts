import type { AssetStore } from '@/types'

// ⚠️ 兩個獨立品牌，依 store 維度切換：
//   mattress → 席樂頓床墊 Sleep Train（美國名床）
//   bedding  → 奧斯汀寢飾 Austin Home（居家寢飾）

export const BRAND_KNOWLEDGE_MATTRESS = `
品牌：Sleeptrain 美國席樂頓名床（床墊）
官網：https://www.sleeptrain.com.tw/
品牌定位：來自美國加州的奢華（品牌源自美國加州的血統與設計）
製造產地：台灣廠製造
⚠️ 用字規範：可訴求「源自美國加州」「美國品牌」「加州奢華血統」等品牌定位；
   但產品為台灣廠製造，絕不可寫「美國製造」「美國原裝進口」「Made in USA」等不實產地宣稱。
品牌精神：開拓舒眠新世界、讓你一覺睡到天亮
市場地位：全美十大知名床墊品牌，風行全美 50 州
核心技術 / 材質：
- 獨立筒支撐系統、床墊邊緣加固系統
- Sanitized 山寧泰防螨抗菌科技（防螨、抗菌處理）
- DuPont™ 杜邦棉
- 天然蠶絲睡眠因子
定位：科技化睡眠解決方案，主打健康、舒適、抗過敏源與塵螨
目標客群：重視健康睡眠、對防螨抗菌有需求、追求優質睡眠體驗的台灣消費者
`.trim()

export const BRAND_KNOWLEDGE_BEDDING = `
品牌：AUSTIN 奧斯汀寢飾（寢飾 / 居家床品）
⚠️ 品牌顯示名稱：文案一律用「AUSTIN」（全大寫）或中文「奧斯汀」，**絕不可寫「AUSTIN HOME」**。
官網：https://www.austinhome.com.tw/
品牌標語：睡得好，生活更美好 / Make Today Amazing
品牌價值：睡得好，生活更美好 —— 致力打造高品質、舒適、健康的寢具產品，透過美好織品為人們創造更美好的生活
核心價值：優質、創新、服務
品牌三支柱：品質是生命、美學是個性、舒適是真理

品牌歷史：
- 1960 年創立，擁有悠久歷史的台灣寢具品牌
- 由最初代工棉被、枕頭起家，逐步發展為自有品牌通路
- 1985 年台灣寢具市場高峰期，於台中工業區建立廠房，產品行銷全台
- 與來自英國的品牌「AUSTIN」合作，拓展品牌通路

通路規模：
- 台灣最大寢飾經銷通路之一，合作店家近 300 家
- 自營官網、百貨專櫃、量大採購特販等多種通路

代理 / 合作品牌：Austin LONDON、PEANUTS、Classic Teddy、AZING
主要產品線：棉被、寢具布料（床包 / 被套等）、枕頭等居家寢飾
品牌語氣參考：溫暖、貼近生活、帶點機智的口吻（例：「棉被，就蓋暖一點吧」「枕頭，就多一點支撐吧」）

⚠️ 品牌名稱大小寫鐵律（不可違反，違者重寫）：
- SNOOPY：永遠全大寫（不可寫 Snoopy / snoopy）
- PEANUTS：永遠全大寫
- AUSTIN：永遠全大寫（house brand 一律寫「AUSTIN」或中文「奧斯汀」，**禁止寫「AUSTIN HOME」**）
- AZING：永遠全大寫
- Austin LONDON：固定這個大小寫（Austin 首字大寫、LONDON 全大寫）
- Classic Teddy：固定這個大小寫（兩字首字大寫）
- Sleeptrain：固定這個大小寫（S 大寫、其餘小寫，是品牌官方寫法）

⚠️ 單一品牌一致性鐵律（不可違反，違者重寫）：
一篇文案只能有「一個」品牌識別，**絕不可把 house brand（AUSTIN / 奧斯汀）與聯名角色 / 子品牌（SNOOPY、PEANUTS、Classic Teddy、AZING、Austin LONDON 等）混在同一篇**。
- 當主題 / 描述 / 參考圖聚焦於某個聯名角色（例如 SNOOPY）時：整篇（正文 + 標題 + Description + hashtag + 結尾署名）**只圍繞該角色**，AUSTIN / 奧斯汀 **100% 不可出現**（一次都不行，含 hashtag 與署名）。
- 當沒有特定聯名角色、就是賣 house brand 自家寢飾時：用「AUSTIN」或「奧斯汀」，此時不要硬塞聯名角色。
- ❌ 反例（嚴禁）：同一組廣告標題裡同時出現「SNOOPY涼被」與「AUSTIN涼被」；正文講 SNOOPY 卻在 hashtag 放 #奧斯汀。
- ✅ 正例：主打 SNOOPY → 全篇只有 SNOOPY / PEANUTS 相關字樣與 hashtag（#SNOOPY #史努比 等），完全不見 AUSTIN。
`.trim()

export function getBrandKnowledge(store: AssetStore): string {
  return store === 'mattress' ? BRAND_KNOWLEDGE_MATTRESS : BRAND_KNOWLEDGE_BEDDING
}

// 攝影風格指引（品牌中性，供未來圖片生成使用）
export const PHOTOGRAPHER_SYSTEM_PROMPT = `
你是一位專精高端家居攝影的資深商業攝影師，擁有 20 年為精品寢具 / 床墊品牌拍攝型錄的經驗。

你絕對不做的事：
- 不加任何文字或浮水印
- 不改變產品本身的外觀、銘牌、材質
- 不放人物
- 不用塑膠感的 3D 渲染風格
- 不加 AI 浮水印或裝飾性符號
- 不加品牌 Logo

風格原則：
- 追求「攝影感」而非「渲染感」，要像真實拍出來的照片
- 材質細節要清晰：布料縫線、金屬光澤、纖維紋理
- 自然的光影過渡，不要 HDR 過度處理
- 產品永遠是主角，場景是配角
- 預留文字空間（構圖留白）
`.trim()

export const NEGATIVE_PROMPT = `No text, no watermarks, no logos, no people, no plastic 3D render style, no artificial HDR, no over-saturation, no cartoon style.`.trim()
