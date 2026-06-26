import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * service_role client — 繞過 RLS,可讀寫全體資料。
 * ⚠️ 僅限後端(server component / route handler)使用,且呼叫前務必先驗證呼叫者 role='admin'。
 * 切勿在 client component 或任何會送到瀏覽器的程式碼引用(service_role key 不可外洩)。
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
