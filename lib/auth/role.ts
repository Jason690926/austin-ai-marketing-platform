import { createClient } from '@/lib/supabase/server'

export type UserRole = 'admin' | 'editor'

export interface CurrentUser {
  id: string
  email: string
  role: UserRole
}

/**
 * 讀取目前登入者 + 角色(讀自己那列,RLS 允許 auth.uid()=id)。未登入回 null。
 * 防禦性:role 欄位查不到 / 值非 'admin' 一律當 editor(最小權限,寧缺勿濫)。
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role: UserRole = data?.role === 'admin' ? 'admin' : 'editor'
  return { id: user.id, email: user.email!, role }
}
