import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/role'
import { AppShell } from '@/components/layout/app-shell'
import { CopyTab } from '@/components/generator/copy-tab'

export default async function CopyGeneratorPage() {
  const me = await getCurrentUser()
  if (!me) redirect('/login')

  async function logout() {
    'use server'
    const supabase = createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <AppShell user={{ email: me.email }} isAdmin={me.role === 'admin'} logoutAction={logout}>
      <div className="p-8 max-w-3xl">
        <h2 className="text-2xl font-bold mb-1">文案產生</h2>
        <p className="text-muted-foreground text-sm mb-8">使用 AI 撰寫品牌行銷文案</p>
        <CopyTab isAdmin={me.role === 'admin'} />
      </div>
    </AppShell>
  )
}
