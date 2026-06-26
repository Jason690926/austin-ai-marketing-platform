'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Shield, User, Loader2 } from 'lucide-react'

export interface ManagedUser {
  id: string
  email: string
  name: string | null
  role: 'admin' | 'editor'
}

export function UsersManager({
  initialUsers,
  currentUserId,
}: {
  initialUsers: ManagedUser[]
  currentUserId: string
}) {
  const [users, setUsers] = useState(initialUsers)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function setRole(target: ManagedUser, role: 'admin' | 'editor') {
    if (target.role === role || pendingId) return
    setPendingId(target.id)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: target.id, role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '更新失敗')
      setUsers(prev => prev.map(u => (u.id === target.id ? { ...u, role } : u)))
    } catch (e: any) {
      setError(e?.message || '更新失敗')
    } finally {
      setPendingId(null)
    }
  }

  const adminCount = users.filter(u => u.role === 'admin').length

  return (
    <div>
      {error && (
        <div className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive mb-4">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">使用者</th>
              <th className="px-3 py-2.5 font-medium">目前角色</th>
              <th className="px-4 py-2.5 font-medium text-right">設定</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const isSelf = u.id === currentUserId
              const busy = pendingId === u.id
              return (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.name || u.email}</div>
                    {u.name && <div className="text-xs text-muted-foreground">{u.email}</div>}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
                      u.role === 'admin'
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {u.role === 'admin' ? <Shield size={11} /> : <User size={11} />}
                      {u.role === 'admin' ? '管理者' : '企劃'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {busy && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
                      {isSelf ? (
                        <span className="text-xs text-muted-foreground">（自己,不可變更）</span>
                      ) : (
                        <div className="inline-flex rounded-lg border border-border overflow-hidden">
                          <button
                            disabled={busy}
                            onClick={() => setRole(u, 'editor')}
                            className={`px-3 py-1 text-xs transition-colors disabled:opacity-50 ${
                              u.role === 'editor'
                                ? 'bg-primary text-primary-foreground font-medium'
                                : 'hover:bg-muted text-muted-foreground'
                            }`}
                          >
                            企劃
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => setRole(u, 'admin')}
                            className={`px-3 py-1 text-xs transition-colors disabled:opacity-50 border-l border-border ${
                              u.role === 'admin'
                                ? 'bg-primary text-primary-foreground font-medium'
                                : 'hover:bg-muted text-muted-foreground'
                            }`}
                          >
                            管理者
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
        ※ <strong>管理者</strong>可使用自動發文、管理者統計與人員管理;<strong>企劃</strong>只能產圖 / 產文 / 用素材庫。
        目前共 {adminCount} 位管理者。無法變更自己的角色(避免把自己鎖在門外),需由另一位管理者調整。
      </p>
    </div>
  )
}
