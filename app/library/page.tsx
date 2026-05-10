import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/app-shell'

export default async function LibraryPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  async function logout() {
    'use server'
    const supabase = createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <AppShell user={{ email: user.email! }} logoutAction={logout}>
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-1">素材庫</h2>
        <p className="text-muted-foreground text-sm mb-8">管理所有已產生的行銷素材</p>
        <div className="rounded-lg border border-border p-16 text-center text-muted-foreground text-sm">
          素材庫功能建置中...
        </div>
      </div>
    </AppShell>
  )
}
