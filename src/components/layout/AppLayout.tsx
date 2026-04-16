import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { Sidebar } from './Sidebar'
import { MobileBottomNav } from './MobileBottomNav'
import { PushPermissionBanner } from '../PushPermissionBanner'

export function AppLayout() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1019] via-[#0e1e33] to-[#0a1525] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-veon border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    const returnTo = location.pathname + location.search
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1019] via-[#0e1e33] to-[#0a1525]">
      {/* Mobile top bar (just logo) */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center gap-2 bg-bg-sidebar border-b border-navy-800 px-4 py-3 md:hidden">
        <GraduationCap className="w-6 h-6 text-red-veon" />
        <h1 className="text-base font-bold text-text-primary">Academia Veon</h1>
      </div>

      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content */}
      <main
        className="min-h-screen pt-14 px-4 md:pt-0 md:px-8 md:ml-64 md:p-8"
        style={{
          paddingBottom: `calc(env(safe-area-inset-bottom) + 80px)`,
        }}
      >
        <div className="md:pb-0">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <MobileBottomNav />

      {/* Push notification permission banner */}
      <PushPermissionBanner />
    </div>
  )
}
