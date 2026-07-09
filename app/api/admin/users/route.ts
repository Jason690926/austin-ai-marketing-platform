import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 改某使用者的角色(admin/editor)。僅 admin 可呼叫(後端再驗一次,不靠前端隱藏)。
export async function POST(request: Request) {
  // 1. 驗呼叫者為 admin
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const { data: caller } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: '權限不足:僅管理者可變更角色' }, { status: 403 })
  }

  // 2. 解析 body
  let body: { userId?: string; role?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '請求格式錯誤' }, { status: 400 })
  }
  const { userId, role } = body
  if (!userId || (role !== 'admin' && role !== 'editor')) {
    return NextResponse.json({ error: '參數錯誤(userId / role)' }, { status: 400 })
  }

  // 3. 不可改自己的角色(避免把自己降權鎖在門外)
  if (userId === user.id) {
    return NextResponse.json({ error: '無法變更自己的角色,請由另一位管理者操作' }, { status: 400 })
  }

  // 4. service_role 更新目標使用者(繞 RLS);select 回寫確認真的有改到列
  const admin = createAdminClient()
  const { data: updated, error } = await admin
    .from('users')
    .update({ role })
    .eq('id', userId)
    .select('id')
  if (error) {
    return NextResponse.json({ error: `更新失敗:${error.message}` }, { status: 500 })
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: '查無此使用者' }, { status: 404 })
  }

  return NextResponse.json({ success: true, userId, role })
}
