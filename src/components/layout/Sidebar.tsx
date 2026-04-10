import { useLocation, useNavigate } from 'react-router-dom'
import { GraduationCap, LogOut, Settings, Users, BookOpen, Layers, Shield, BarChart3, Link2, LayoutDashboard, UserCircle, MessagesSquare } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export function Sidebar() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isGestor = profile?.role === 'gestor'

  const tripulanteLinks = [
    { path: '/treinamentos', label: 'Treinamentos', icon: BookOpen },
    { path: '/comunidade', label: 'Feed', icon: MessagesSquare },
    { path: '/perfil', label: 'Meu Perfil', icon: UserCircle },
  ]

  const gestorLinks = [
    { path: '/gestor', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/gestor/treinamentos', label: 'Treinamentos', icon: Layers },
    { path: '/gestor/tripulantes', label: 'Tripulantes', icon: Users },
    { path: '/gestor/turmas', label: 'Turmas', icon: Shield },
    { path: '/gestor/engajamento', label: 'Engajamento', icon: BarChart3 },
    { path: '/gestor/liberacoes', label: 'Liberações', icon: Settings },
    { path: '/gestor/links-cadastro', label: 'Links de Cadastro', icon: Link2 },
  ]

  const links = isGestor ? gestorLinks : tripulanteLinks

  const handleNavigate = (path: string) => {
    navigate(path)
  }

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 bg-bg-sidebar border-r border-navy-800 flex-col z-50">
        {/* Header */}
        <div className="p-6 border-b border-navy-800">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-red-veon" />
            <div>
              <h1 className="text-lg font-bold text-text-primary">Academia Veon</h1>
              <p className="text-xs text-text-muted">Tripulação Veon</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {isGestor && (
            <p className="text-xs text-text-muted uppercase tracking-wider mb-3 px-3">Gestão</p>
          )}
          {links.map((link) => {
            const Icon = link.icon
            const isActive = link.path === '/gestor'
              ? location.pathname === '/gestor'
              : location.pathname === link.path || location.pathname.startsWith(link.path + '/')
            return (
              <button
                key={link.path}
                onClick={() => handleNavigate(link.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-navy-900 text-red-veon'
                    : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'
                }`}
              >
                <Icon className="w-5 h-5" />
                {link.label}
              </button>
            )
          })}

          {isGestor && (
            <>
              <div className="border-t border-navy-800 my-4" />
              <p className="text-xs text-text-muted uppercase tracking-wider mb-3 px-3">Aluno</p>
              {tripulanteLinks.map((link) => {
                const Icon = link.icon
                const isActive = location.pathname === link.path
                return (
                  <button
                    key={link.path}
                    onClick={() => handleNavigate(link.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-navy-900 text-red-veon'
                        : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {link.label}
                  </button>
                )
              })}
            </>
          )}
        </nav>

        {/* User info & logout */}
        <div className="p-4 border-t border-navy-800">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{profile?.name}</p>
              <p className="text-xs text-text-muted capitalize">{profile?.role}</p>
            </div>
            <button
              onClick={signOut}
              className="p-2 text-text-muted hover:text-red-veon transition-colors"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
    </aside>
  )
}
