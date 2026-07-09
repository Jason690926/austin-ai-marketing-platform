import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/role'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppShell } from '@/components/layout/app-shell'
import { Image as ImageIcon, FileText, Send, DollarSign, Users } from 'lucide-react'

// 花費推估單價(USD/張)— 來源:CLAUDE.md 模型分流段
// Level 1 底圖走 Nano Banana 2(Flash) ≈ $0.039;Level 2/3 燒字走 Nano Banana Pro ≈ $0.134
const COST_BASE = 0.039
const COST_PRO = 0.134

interface UserStat {
  id: string
  email: string
  name: string | null
  role: string
  baseImages: number   // level1_base
  burnImages: number   // level2_complete(Level 2/3,走 Pro)
  copies: number       // 文案 / 文章
  posts: number        // 成功發文數
  estCost: number      // 推估花費 USD
}

function fmtUSD(n: number): string {
  return `$${n.toFixed(2)}`
}

// PostgREST 單次查詢預設上限 1000 列 — 不分頁的話超過 1000 筆後統計會「默默少算」。
// 用 .range() 迴圈撈完;order by id 確保跨頁不重不漏。
async function fetchAll<Row>(
  buildQuery: () => any,
): Promise<{ rows: Row[]; error: string | null }> {
  const PAGE = 1000
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await buildQuery().order('id').range(from, from + PAGE - 1)
    if (error) return { rows, error: error.message }
    rows.push(...((data ?? []) as Row[]))
    if (!data || data.length < PAGE) break
  }
  return { rows, error: null }
}

export default async function AdminPage() {
  const me = await getCurrentUser()
  if (!me) redirect('/login')
  if (me.role !== 'admin') redirect('/generator')

  async function logout() {
    'use server'
    const supabase = createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  // service_role 繞過 RLS 抓全體(呼叫者已驗證為 admin)
  const admin = createAdminClient()
  const [usersRes, assetsRes, postsRes] = await Promise.all([
    fetchAll<{ id: string; email: string; name: string | null; role: string | null }>(
      () => admin.from('users').select('id, email, name, role'),
    ),
    fetchAll<{ user_id: string | null; type: string; image_level: string | null; source: string }>(
      () => admin.from('assets').select('user_id, type, image_level, source'),
    ),
    fetchAll<{ user_id: string | null; status: string }>(
      () => admin.from('posts').select('user_id, status'),
    ),
  ])

  const loadError = usersRes.error || assetsRes.error || postsRes.error || null

  const statMap = new Map<string, UserStat>()
  for (const u of usersRes.rows) {
    statMap.set(u.id, {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role ?? 'editor',
      baseImages: 0,
      burnImages: 0,
      copies: 0,
      posts: 0,
      estCost: 0,
    })
  }

  // 容錯:遇到 users 表沒有的 user_id(理論上不會)也建一筆
  function ensure(userId: string | null): UserStat | null {
    if (!userId) return null
    let s = statMap.get(userId)
    if (!s) {
      s = { id: userId, email: '(未知使用者)', name: null, role: 'editor', baseImages: 0, burnImages: 0, copies: 0, posts: 0, estCost: 0 }
      statMap.set(userId, s)
    }
    return s
  }

  for (const a of assetsRes.rows) {
    const s = ensure(a.user_id)
    if (!s) continue
    if (a.type === 'image') {
      // 使用者上傳圖 / 無 level 標記的圖不是 AI 產圖,不計張數也不計費
      if (a.source === 'user_uploaded' || !a.image_level) continue
      if (a.image_level === 'level2_complete') s.burnImages++
      else s.baseImages++
    } else {
      s.copies++
    }
  }

  for (const p of postsRes.rows) {
    const s = ensure(p.user_id)
    if (!s) continue
    if (p.status === 'success') s.posts++
  }

  const stats = Array.from(statMap.values())
  for (const s of stats) {
    s.estCost = s.baseImages * COST_BASE + s.burnImages * COST_PRO
  }
  stats.sort((a, b) => b.estCost - a.estCost)

  const totals = stats.reduce(
    (acc, s) => {
      acc.baseImages += s.baseImages
      acc.burnImages += s.burnImages
      acc.copies += s.copies
      acc.posts += s.posts
      acc.estCost += s.estCost
      return acc
    },
    { baseImages: 0, burnImages: 0, copies: 0, posts: 0, estCost: 0 },
  )

  const summary = [
    { label: '使用者', value: String(stats.length), icon: Users },
    { label: '產圖總張數', value: String(totals.baseImages + totals.burnImages), icon: ImageIcon },
    { label: '產文總篇數', value: String(totals.copies), icon: FileText },
    { label: '成功發文', value: String(totals.posts), icon: Send },
    { label: '推估花費', value: fmtUSD(totals.estCost), icon: DollarSign },
  ]

  return (
    <AppShell user={{ email: me.email }} isAdmin logoutAction={logout}>
      <div className="p-8 max-w-5xl">
        <h2 className="text-2xl font-bold mb-1">管理者統計</h2>
        <p className="text-muted-foreground text-sm mb-8">
          各使用者的產圖 / 產文 / 發文用量與推估花費
        </p>

        {loadError && (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive mb-6">
            讀取失敗：{loadError}
          </div>
        )}

        {/* 總覽卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {summary.map(c => (
            <div key={c.label} className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <c.icon size={13} />
                {c.label}
              </div>
              <div className="text-xl font-bold">{c.value}</div>
            </div>
          ))}
        </div>

        {/* 逐使用者表 */}
        {stats.length === 0 ? (
          <div className="rounded-lg border border-border p-8 text-sm text-muted-foreground text-center">
            尚無使用者資料。
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">使用者</th>
                  <th className="px-3 py-2.5 font-medium">角色</th>
                  <th className="px-3 py-2.5 font-medium text-right">底圖</th>
                  <th className="px-3 py-2.5 font-medium text-right">燒字圖</th>
                  <th className="px-3 py-2.5 font-medium text-right">文案</th>
                  <th className="px-3 py-2.5 font-medium text-right">發文</th>
                  <th className="px-4 py-2.5 font-medium text-right">推估花費</th>
                </tr>
              </thead>
              <tbody>
                {stats.map(s => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{s.name || s.email}</div>
                      {s.name && <div className="text-xs text-muted-foreground">{s.email}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-xs ${
                        s.role === 'admin'
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {s.role === 'admin' ? '管理者' : '企劃'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.baseImages}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.burnImages}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.copies}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.posts}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">{fmtUSD(s.estCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
          ※ 花費為<strong>推估值</strong>（底圖 ${COST_BASE}/張、燒字圖走 Pro ${COST_PRO}/張，文案成本極低未計入），
          非帳單級精確；以 Google Cloud 帳單為準。「燒字圖」含 Level 2 完整廣告與 Level 3 AI 全權自主。
          統計依素材庫現存素材計算，已刪除的素材不列入；使用者上傳的圖片不計費。
        </p>
      </div>
    </AppShell>
  )
}
