import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/app-shell'
import { ImageTab } from '@/components/generator/image-tab'

export default async function ImageGeneratorPage() {
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
      <div className="p-8 max-w-3xl">
        <h2 className="text-2xl font-bold mb-1">圖片產生</h2>
        <p className="text-muted-foreground text-sm mb-8">使用 AI 產生品牌形象圖片</p>
        <ImageTab />
      </div>
    </AppShell>
  )
}
