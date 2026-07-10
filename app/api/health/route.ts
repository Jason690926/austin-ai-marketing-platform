import { NextResponse } from 'next/server'

// 健康檢查端點 — 給 Cloud Run probe / 外部監控用,不需登入(middleware 已放行)。
// 刻意保持輕量:只回報「容器活著 + 關鍵 env 有無載入」,不打 Supabase/Gemini
// (避免監控高頻打掛外部配額;深度檢查交給錯誤告警)。

export const runtime = 'nodejs'
// 只有 GET 且不讀 request 的 route 會被 Next 在 build 時靜態化,env 檢查會變成
// build 當下的快照(runtime secrets 全 false)— 必須強制動態才反映真實 runtime env。
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    ok: true,
    // 缺關鍵 env 時仍回 200(容器本身健康),但標出來方便部署後一眼排查
    env: {
      supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
      sheets: !!process.env.GOOGLE_SHEETS_SA_JSON,
    },
  })
}
