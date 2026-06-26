import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/role'
import { AppShell } from '@/components/layout/app-shell'
import { LibraryView } from '@/components/library/library-view'
import type { Asset } from '@/types'

export default async function LibraryPage() {
  const me = await getCurrentUser()
  if (!me) redirect('/login')

  const supabase = createClient()

  async function logout() {
    'use server'
    const supabase = createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  const { data: assets, error } = await supabase
    .from('assets')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <AppShell user={{ email: me.email }} isAdmin={me.role === 'admin'} logoutAction={logout}>
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-1">素材庫</h2>
        <p className="text-muted-foreground text-sm mb-8">管理所有已產生的行銷素材</p>
        {error ? (
          <div className="rounded-lg border border-destructive/30 p-6 text-sm text-destructive">
            讀取失敗：{error.message}
          </div>
        ) : (
          <LibraryView initialAssets={(assets ?? []) as Asset[]} />
        )}
      </div>
    </AppShell>
  )
}
