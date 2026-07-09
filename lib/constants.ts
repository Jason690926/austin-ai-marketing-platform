// 全站共用的顯示標籤 — 單一來源。
// 之前 library-view 與 publish-view 各自定義且文字不一致(「席樂頓床墊」vs「床墊」),
// 收攏到這裡;新頁面顯示 store / purpose / type 一律從這裡 import。

import type { AssetType, AssetStore, AssetPurpose } from '@/types'

export const TYPE_LABEL: Record<AssetType, string> = { copy: '文案', image: '圖片' }

export const STORE_LABEL: Record<AssetStore, string> = {
  mattress: '席樂頓床墊',
  bedding: '奧斯汀寢飾',
}

export const PURPOSE_LABEL: Record<AssetPurpose, string> = {
  ad: 'Meta 廣告',
  google_search_ad: 'Google 搜尋廣告 RSA',
  pmax_ad: 'Google 多素材廣告',
  post: 'IG 貼文',
  fb_post: 'FB 貼文',
  web_brand: '品牌故事',
  web_product: '商品介紹',
  seo_article: 'SEO / AEO / GEO',
}
