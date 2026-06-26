import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/role'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppShell } from '@/components/layout/app-shell'
import { UsersManager, type ManagedUser } from '@/components/admin/users-manager'

export default async function AdminUsersPage() {
  const me = await getCurrentUser()
  if (!me) redirect('/login')
  if (me.role !== 'admin') redirect('/generator')

  async function logout() {
    'use server'
    const supabase = createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  // service_role 抓全體使用者(呼叫者已驗證為 admin)
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('users')
    .select('id, email, name, role')
    .order('email', { ascending: true })

  const users: ManagedUser[] = (data ?? []).map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role === 'admin' ? 'admin' : 'editor',
  }))

  return (
    <AppShell user={{ email: me.email }} isAdmin logoutAction={logout}>
      <div className="p-8 max-w-3xl">
        <h2 className="text-2xl font-bold mb-1">人員管理</h2>
        <p className="text-muted-foreground text-sm mb-8">
          點選即可設定各使用者為管理者 / 企劃,免進 Supabase 跑 SQL
        </p>

        {error ? (
          <div className="rounded-lg border border-destructive/30 p-6 text-sm text-destructive">
            讀取失敗：{error.message}
          </div>
        ) : (
          <UsersManager initialUsers={users} currentUserId={me.id} />
        )}
      </div>
    </AppShell>
  )
}
