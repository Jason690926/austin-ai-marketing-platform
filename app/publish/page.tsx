import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/app-shell'
import { PublishView } from '@/components/publish/publish-view'
import { getMetaPages, type MetaPagePublic } from '@/lib/meta/client'
import type { Asset } from '@/types'

export default async function PublishPage({
  searchParams,
}: {
  searchParams: { assetId?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  async function logout() {
    'use server'
    const supabase = createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  // Page 清單(不含 access token)
  let pages: MetaPagePublic[] = []
  let pagesError: string | null = null
  try {
    pages = getMetaPages().map(p => ({ pageId: p.pageId, pageName: p.pageName }))
  } catch (e: any) {
    pagesError = e?.message || 'Meta 未設定'
  }

  // 可選文案(素材庫的 copy 素材)
  const { data: assets } = await supabase
    .from('assets')
    .select('*')
    .eq('type', 'copy')
    .order('created_at', { ascending: false })

  return (
    <AppShell user={{ email: user.email! }} logoutAction={logout}>
      <div className="p-8 max-w-3xl">
        <h2 className="text-2xl font-bold mb-1">發布貼文</h2>
        <p className="text-muted-foreground text-sm mb-8">
          挑選文案 + 上傳圖片,一鍵發布到 Facebook 粉專
        </p>
        <PublishView
          pages={pages}
          pagesError={pagesError}
          copyAssets={(assets ?? []) as Asset[]}
          initialAssetId={searchParams.assetId ?? null}
        />
      </div>
    </AppShell>
  )
}
