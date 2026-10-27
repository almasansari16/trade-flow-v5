import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { usePreference } from '@/hooks/misc'
import { Sidebar, SidebarNav } from './Sidebar'
import { GlobalSearch, Topbar } from './Topbar'
import { Logo } from './Logo'

export function AppShell() {
  const [collapsed, setCollapsed] = usePreference('sidebar-collapsed', false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMobileOpen(false)
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow-lg">
        Skip to content
      </a>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-midnight/50" onClick={() => setMobileOpen(false)} aria-hidden />
          <div role="dialog" aria-modal="true" aria-label="Navigation" className="relative flex h-full w-72 max-w-[85vw] animate-slide-in-right flex-col bg-midnight" style={{ animationName: 'none' }}>
            <div className="flex h-12 items-center justify-between border-b border-white/5 px-4">
              <Logo dark />
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
                <X className="size-5" />
              </button>
            </div>
            <div className="border-b border-white/5 p-3 sm:hidden [&_input]:bg-white [&_input]:border-transparent">
              <GlobalSearch />
            </div>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileNav={() => setMobileOpen(true)} />
        <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4 sm:px-5 lg:px-6 lg:py-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
