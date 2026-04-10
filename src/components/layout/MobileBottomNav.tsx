import { useLocation, useNavigate } from 'react-router-dom'
import { MessagesSquare, BookOpen, UserCircle, LayoutDashboard } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export function MobileBottomNav() {
  const { profile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isGestor = profile?.role === 'gestor'

  const tripulanteLinks = [
    { path: '/comunidade', label: 'Feed', icon: MessagesSquare },
    { path: '/treinamentos', label: 'Treinamentos', icon: BookOpen },
    { path: '/perfil', label: 'Perfil', icon: UserCircle },
  ]

  const gestorLinks = [
    { path: '/gestor', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/comunidade', label: 'Feed', icon: MessagesSquare },
    { path: '/perfil', label: 'Perfil', icon: UserCircle },
  ]

  const links = isGestor ? gestorLinks : tripulanteLinks

  function isActive(path: string) {
    if (path === '/gestor') return location.pathname === '/gestor'
    if (path === '/perfil') return location.pathname === '/perfil' || location.pathname.startsWith('/perfil/')
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-bg-sidebar border-t border-navy-800 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around">
        {links.map((link) => {
          const Icon = link.icon
          const active = isActive(link.path)
          return (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-2 relative transition-colors"
              aria-label={link.label}
            >
              <Icon
                className={`w-6 h-6 transition-colors ${
                  active ? 'text-red-veon' : 'text-text-muted'
                }`}
                strokeWidth={active ? 2.5 : 2}
              />
              <span
                className={`text-[10px] font-medium transition-colors ${
                  active ? 'text-red-veon' : 'text-text-muted'
                }`}
              >
                {link.label}
              </span>
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-red-veon rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
