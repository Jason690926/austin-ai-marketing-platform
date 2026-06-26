'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles, Images, LogOut, Image, FileText, Send, History, BarChart3 } from 'lucide-react'

type NavItem =
  | { label: string; icon: typeof Sparkles; href: string; adminOnly?: boolean }
  | { label: string; icon: typeof Sparkles; children: { href: string; label: string; icon: typeof Sparkles }[]; adminOnly?: boolean }

const NAV: NavItem[] = [
  {
    label: '素材產生器',
    icon: Sparkles,
    children: [
      { href: '/generator/image', label: '圖片產生', icon: Image },
      { href: '/generator/copy',  label: '文案產生', icon: FileText },
    ],
  },
  {
    label: '素材庫',
    icon: Images,
    href: '/library',
  },
  {
    label: '自動發文',
    icon: Send,
    adminOnly: true,
    children: [
      { href: '/publish', label: '發布貼文', icon: Send },
      { href: '/posts',   label: '發文紀錄', icon: History },
    ],
  },
  {
    label: '管理者統計',
    icon: BarChart3,
    href: '/admin',
    adminOnly: true,
  },
]

interface AppShellProps {
  children: React.ReactNode
  user: { email: string }
  isAdmin?: boolean
  logoutAction: () => Promise<void>
}

export function AppShell({ children, user, isAdmin = false, logoutAction }: AppShellProps) {
  const pathname = usePathname()
  const nav = NAV.filter(item => !item.adminOnly || isAdmin)

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border flex flex-col">
        <div className="px-5 py-5 border-b border-border">
          <span className="font-bold text-base tracking-tight">AI 行銷平台</span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            if ('children' in item) {
              const parentActive = item.children.some(c => pathname === c.href)
              return (
                <div key={item.label}>
                  <div className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium ${
                    parentActive ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    <item.icon size={15} />
                    {item.label}
                  </div>
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-3">
                    {item.children.map(child => {
                      const active = pathname === child.href
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                            active
                              ? 'bg-primary text-primary-foreground font-medium'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          }`}
                        >
                          <child.icon size={13} />
                          {child.label}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            }

            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <item.icon size={15} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut size={13} />
              登出
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
