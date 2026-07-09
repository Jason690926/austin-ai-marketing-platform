import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/role'
import { AppShell } from '@/components/layout/app-shell'
import { Check, AlertTriangle, ExternalLink } from 'lucide-react'
import type { Post } from '@/types'

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

const PAGE_SIZE = 50

export default async function PostsPage({
  searchParams,
}: {
  searchParams?: { page?: string }
}) {
  const me = await getCurrentUser()
  if (!me) redirect('/login')
  if (me.role !== 'admin') redirect('/generator')

  async function logout() {
    'use server'
    const supabase = createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  const page = Math.max(1, parseInt(searchParams?.page ?? '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE

  // 本頁限 admin(上方已驗),用 service_role 讀全公司紀錄 —
  // 一般 client 受 RLS 限制只看得到自己發的,多位 admin 會互相看不到
  const admin = createAdminClient()
  const { data: posts, error, count } = await admin
    .from('posts')
    .select('*', { count: 'exact' })
    .order('published_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  const rows = (posts ?? []) as Post[]
  const total = count ?? rows.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <AppShell user={{ email: me.email }} isAdmin logoutAction={logout}>
      <div className="p-8 max-w-3xl">
        <h2 className="text-2xl font-bold mb-1">發文紀錄</h2>
        <p className="text-muted-foreground text-sm mb-8">
          每一列代表一次發布到單一粉專的結果（全公司紀錄，共 {total} 筆）
        </p>

        {error ? (
          <div className="rounded-lg border border-destructive/30 p-6 text-sm text-destructive">
            讀取失敗：{error.message}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-border p-8 text-sm text-muted-foreground text-center">
            尚無發文紀錄。到「發布貼文」發出第一篇貼文吧。
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(p => (
              <div
                key={p.id}
                className={`rounded-lg border p-3 ${
                  p.status === 'success'
                    ? 'border-border'
                    : 'border-destructive/40 bg-destructive/5'
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  {p.status === 'success' ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                      <Check size={13} /> 成功
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle size={13} /> 失敗
                    </span>
                  )}
                  <span className="text-sm font-medium">{p.page_name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatTime(p.published_at)}
                  </span>
                </div>

                <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                  {p.copy_text}
                </p>

                {p.status === 'success' && p.meta_post_id && (
                  <a
                    href={`https://www.facebook.com/${p.meta_post_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-emerald-700 hover:underline inline-flex items-center gap-1 mt-1.5"
                  >
                    在 Facebook 查看 <ExternalLink size={11} />
                  </a>
                )}
                {p.status === 'failed' && p.error_message && (
                  <p className="text-xs text-destructive mt-1.5">✗ {p.error_message}</p>
                )}
              </div>
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 text-sm">
                {page > 1 ? (
                  <a href={`/posts?page=${page - 1}`} className="text-muted-foreground hover:text-foreground">
                    ← 較新的紀錄
                  </a>
                ) : <span />}
                <span className="text-xs text-muted-foreground">第 {page} / {totalPages} 頁</span>
                {page < totalPages ? (
                  <a href={`/posts?page=${page + 1}`} className="text-muted-foreground hover:text-foreground">
                    較舊的紀錄 →
                  </a>
                ) : <span />}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
