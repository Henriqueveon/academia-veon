import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  MessagesSquare, BookOpen, UserCircle, LayoutDashboard, Menu, X, LogOut,
  Users, Shield, BarChart3, Settings, Link2, Layers, Wallet
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export function MobileBottomNav() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isGestor = profile?.role === 'gestor'
  const [menuOpen, setMenuOpen] = useState(false)

  const tripulanteLinks = [
    { path: '/comunidade', label: 'Feed', icon: MessagesSquare },
    { path: '/treinamentos', label: 'Treinamentos', icon: BookOpen },
    { path: '/perfil', label: 'Perfil', icon: UserCircle },
  ]

  // Gestor bottom: 4 itens principais + "Mais"
  const gestorBottomLinks = [
    { path: '/gestor', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/comunidade', label: 'Feed', icon: MessagesSquare },
    { path: '/perfil', label: 'Perfil', icon: UserCircle },
  ]

  // Itens extras do gestor (vão no drawer "Mais")
  const gestorExtraLinks = [
    { path: '/gestor/treinamentos', label: 'Treinamentos', icon: Layers },
    { path: '/gestor/tripulantes', label: 'Tripulantes', icon: Users },
    { path: '/gestor/turmas', label: 'Turmas', icon: Shield },
    { path: '/gestor/engajamento', label: 'Engajamento', icon: BarChart3 },
    { path: '/gestor/liberacoes', label: 'Liberações', icon: Settings },
    { path: '/gestor/links-cadastro', label: 'Links de Cadastro', icon: Link2 },
    { path: '/treinamentos', label: 'Ver como aluno', icon: BookOpen },
  ]

  const bottomLinks = isGestor ? gestorBottomLinks : tripulanteLinks

  function isActive(path: string) {
    if (path === '/gestor') return location.pathname === '/gestor'
    if (path === '/perfil') return location.pathname === '/perfil' || location.pathname.startsWith('/perfil/')
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  function handleNavigate(path: string) {
    navigate(path)
    setMenuOpen(false)
  }

  async function handleLogout() {
    setMenuOpen(false)
    await signOut()
  }

  return (
    <>
      {/* Bottom nav bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-bg-sidebar border-t border-navy-800 md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around">
          {bottomLinks.map((link) => {
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

          {/* "Mais" button — always visible */}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-2 relative transition-colors"
            aria-label="Mais opções"
          >
            <Menu className="w-6 h-6 text-text-muted" strokeWidth={2} />
            <span className="text-[10px] font-medium text-text-muted">Mais</span>
          </button>
        </div>
      </nav>

      {/* Drawer overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 md:hidden"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-bg-sidebar border-t border-navy-800 rounded-t-2xl max-h-[85vh] overflow-y-auto"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-navy-700 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-navy-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-navy-900 flex items-center justify-center text-red-veon font-bold flex-shrink-0">
                  {profile?.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">{profile?.name}</p>
                  <p className="text-xs text-text-muted capitalize">{profile?.role}</p>
                </div>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-1.5 text-text-muted hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tripulante extras */}
            {!isGestor && (
              <div className="p-3">
                <button
                  onClick={() => handleNavigate('/creditos')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${
                    location.pathname === '/creditos'
                      ? 'bg-navy-900 text-red-veon'
                      : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'
                  }`}
                >
                  <Wallet className="w-5 h-5" />
                  Meus Créditos
                </button>
              </div>
            )}

            {/* Extra links (gestor) */}
            {isGestor && (
              <div className="p-3">
                <p className="text-xs text-text-muted uppercase tracking-wider px-3 pb-2">Gestão</p>
                {gestorExtraLinks.map((link) => {
                  const Icon = link.icon
                  const active = isActive(link.path)
                  return (
                    <button
                      key={link.path}
                      onClick={() => handleNavigate(link.path)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${
                        active
                          ? 'bg-navy-900 text-red-veon'
                          : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {link.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Logout */}
            <div className="p-3 border-t border-navy-800">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-red-veon hover:bg-red-900/20 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
