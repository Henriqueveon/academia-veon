import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Bell, User, Heart, MessageCircle, UserPlus, Share2, FileText, BookOpen, Sparkles, Wallet, X, ShieldAlert } from 'lucide-react'

interface NotifConfig {
  icon: any
  color: string
  text: (actor: string, extra?: string) => string
}

const NOTIF_LABELS: Record<string, NotifConfig> = {
  share_received: { icon: Share2, color: 'text-blue-400', text: (a) => `${a} compartilhou um post com você` },
  new_follower: { icon: UserPlus, color: 'text-purple-400', text: (a) => `${a} começou a te seguir` },
  post_like: { icon: Heart, color: 'text-red-veon', text: (a) => `${a} curtiu seu post` },
  post_comment: { icon: MessageCircle, color: 'text-green-400', text: (a) => `${a} comentou no seu post` },
  comment_reply: { icon: MessageCircle, color: 'text-green-400', text: (a) => `${a} respondeu seu comentário` },
  new_post_feed: { icon: FileText, color: 'text-cyan-400', text: () => 'Novo post no feed' },
  followed_user_post: { icon: FileText, color: 'text-cyan-400', text: (a) => `${a} publicou um novo post` },
  new_lesson: { icon: BookOpen, color: 'text-yellow-400', text: () => 'Nova aula disponível!' },
  lead_interest: {
    icon: Sparkles,
    color: 'text-yellow-400',
    text: (a, course) => course
      ? `${a} tem interesse no curso "${course}"`
      : `${a} demonstrou interesse em um curso`,
  },
  credit_received: { icon: Wallet, color: 'text-green-400', text: (_, amount) => `Você recebeu ${amount || 'créditos'}` },
  post_blocked: {
    icon: ShieldAlert,
    color: 'text-red-veon',
    text: (_, reason) => reason
      ? `Seu post foi removido da nossa Comunidade. Motivo: ${reason}`
      : 'Seu post foi removido da nossa Comunidade',
  },
}

export function NotificationsBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [blockedModal, setBlockedModal] = useState<{ reason?: string; createdAt: string } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(30)

      if (!data) return []

      const actorIds = [...new Set(data.map((n: any) => n.actor_id).filter(Boolean))]
      const trainingIds = [...new Set(data.map((n: any) => n.training_id).filter(Boolean))]
      // Posts referenced in blocked notifications — fetch to get blocked_reason
      const blockedPostIds = [...new Set(
        data.filter((n: any) => n.type === 'post_blocked' && n.post_id).map((n: any) => n.post_id)
      )]

      let actorsMap = new Map()
      if (actorIds.length > 0) {
        const { data: actors } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', actorIds)
        actorsMap = new Map((actors || []).map((a: any) => [a.id, a]))
      }

      let trainingsMap = new Map()
      if (trainingIds.length > 0) {
        const { data: trns } = await supabase
          .from('trainings')
          .select('id, title')
          .in('id', trainingIds)
        trainingsMap = new Map((trns || []).map((t: any) => [t.id, t]))
      }

      let blockedPostsMap = new Map()
      if (blockedPostIds.length > 0) {
        const { data: bps } = await supabase
          .from('posts')
          .select('id, blocked_reason')
          .in('id', blockedPostIds)
        blockedPostsMap = new Map((bps || []).map((p: any) => [p.id, p]))
      }

      return data.map((n: any) => ({
        ...n,
        actor: n.actor_id ? actorsMap.get(n.actor_id) : null,
        training: n.training_id ? trainingsMap.get(n.training_id) : null,
        blockedPost: n.type === 'post_blocked' && n.post_id ? blockedPostsMap.get(n.post_id) : null,
      }))
    },
    enabled: !!user,
    refetchInterval: 60000,
  })

  const unreadCount = notifications.filter((n: any) => !n.read).length

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase.from('notifications').update({ read: true }).eq('user_id', user!.id).eq('read', false)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markOneRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('notifications').update({ read: true }).eq('id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  // Close on outside click (desktop only — mobile uses overlay)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      // Only handle on desktop
      if (window.innerWidth < 768) return
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleNotifClick(n: any) {
    if (!n.read) markOneRead.mutate(n.id)

    // Post bloqueado: abre modal explicativo (não navega)
    if (n.type === 'post_blocked') {
      setBlockedModal({
        reason: n.blockedPost?.blocked_reason,
        createdAt: n.created_at,
      })
      setOpen(false)
      return
    }

    setOpen(false)

    // Route based on type
    if (n.type === 'lead_interest' && n.actor_id) {
      // Gestor: abre perfil do aluno interessado
      navigate(`/perfil/${n.actor_id}`)
    } else if (n.type === 'new_lesson' && n.lesson_id) {
      ;(async () => {
        const { data: lesson } = await supabase.from('lessons').select('module_id').eq('id', n.lesson_id).single()
        if (lesson) {
          const { data: module } = await supabase.from('modules').select('training_id').eq('id', lesson.module_id).single()
          if (module) navigate(`/treinamentos/${module.training_id}?aula=${n.lesson_id}`)
        }
      })()
    } else if (n.type === 'credit_received') {
      navigate('/creditos')
    } else if (n.post_id) {
      navigate(`/p/${n.post_id}`)
    } else if (n.type === 'new_follower' && n.actor_id) {
      navigate(`/perfil/${n.actor_id}`)
    }
  }

  function formatTime(date: string) {
    const d = new Date(date)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
    if (diff < 60) return 'agora'
    if (diff < 3600) return `${Math.floor(diff / 60)}min`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  // Shared content rendered in both mobile modal and desktop dropdown
  const NotificationsContent = (
    <>
      <div className="flex items-center justify-between p-4 border-b border-navy-800">
        <h3 className="font-semibold text-text-primary">Notificações</h3>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="text-xs text-red-veon hover:text-red-veon-dark"
            >
              Marcar todas lidas
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="md:hidden text-text-muted hover:text-text-primary p-1"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 md:max-h-[60vh]">
        {notifications.length === 0 ? (
          <div className="py-12 text-center text-text-muted">
            <Bell className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Sem notificações</p>
          </div>
        ) : (
          notifications.map((n: any) => {
            const config = NOTIF_LABELS[n.type] || NOTIF_LABELS.new_post_feed
            const Icon = config.icon
            const actorName = n.actor?.name || 'Alguém'
            const extra = n.blockedPost?.blocked_reason || n.training?.title || undefined

            return (
              <button
                key={n.id}
                onClick={() => handleNotifClick(n)}
                className={`w-full flex items-start gap-3 p-3 hover:bg-navy-800 transition-colors text-left border-b border-navy-800/50 ${
                  !n.read ? 'bg-red-veon/5' : ''
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {n.type === 'post_blocked' ? (
                    // Sem foto do gestor — ícone neutro com escudo
                    <div className="w-10 h-10 rounded-full bg-red-veon/20 border border-red-veon/40 flex items-center justify-center">
                      <ShieldAlert className="w-5 h-5 text-red-veon" />
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-navy-900 flex items-center justify-center">
                        {n.actor?.avatar_url ? (
                          <img src={n.actor.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-5 h-5 text-text-muted" />
                        )}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-bg-card flex items-center justify-center ${config.color}`}>
                        <Icon className="w-3 h-3" />
                      </div>
                    </>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary">{config.text(actorName, extra)}</p>
                  <p className="text-xs text-text-muted mt-0.5">{formatTime(n.created_at)}</p>
                </div>

                {!n.read && (
                  <span className="w-2 h-2 rounded-full bg-red-veon flex-shrink-0 mt-2" />
                )}
              </button>
            )
          })
        )}
      </div>
    </>
  )

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2.5 bg-bg-card border border-navy-800 hover:border-navy-600 text-text-secondary hover:text-text-primary rounded-lg transition-colors"
        title="Notificações"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-veon text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center border-2 border-bg-primary">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Mobile: full-screen modal */}
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="bg-bg-card border border-navy-800 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {NotificationsContent}
            </div>
          </div>

          {/* Desktop: dropdown */}
          <div className="hidden md:block absolute right-0 top-12 w-96 bg-bg-card border border-navy-800 rounded-2xl shadow-xl overflow-hidden z-50">
            {NotificationsContent}
          </div>
        </>
      )}

      {/* Modal explicativo quando clica em "Post removido" */}
      {blockedModal && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setBlockedModal(null)}
        >
          <div
            className="bg-bg-card border border-red-veon/40 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-red-veon/10 px-5 py-4 border-b border-red-veon/20 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-veon/20 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-5 h-5 text-red-veon" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-text-primary">Post removido da Comunidade</h2>
                <p className="text-xs text-text-muted mt-0.5">
                  {new Date(blockedModal.createdAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <button
                onClick={() => setBlockedModal(null)}
                className="text-text-muted hover:text-text-primary p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto p-5 space-y-4">
              {/* Motivo do gestor */}
              {blockedModal.reason && (
                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                    Motivo
                  </p>
                  <div className="bg-bg-input border border-navy-700 rounded-lg px-4 py-3">
                    <p className="text-sm text-text-primary whitespace-pre-line">
                      {blockedModal.reason}
                    </p>
                  </div>
                </div>
              )}

              {/* Diretrizes */}
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Diretrizes da Comunidade Veon
                </p>
                <div className="space-y-2.5 text-sm text-text-secondary">
                  <p>
                    A Comunidade Veon é um espaço de aprendizado, troca e crescimento.
                    Para manter o ambiente saudável e produtivo para todos, seguimos estas diretrizes:
                  </p>
                  <ul className="space-y-2 ml-1">
                    <li className="flex gap-2">
                      <span className="text-red-veon flex-shrink-0 mt-0.5">•</span>
                      <span>Respeito mútuo — sem ofensas, discriminação ou assédio.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-red-veon flex-shrink-0 mt-0.5">•</span>
                      <span>Conteúdo relevante — foco em aprendizado, networking e troca de experiências.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-red-veon flex-shrink-0 mt-0.5">•</span>
                      <span>Sem spam — evite conteúdo repetitivo, links suspeitos ou divulgação não autorizada.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-red-veon flex-shrink-0 mt-0.5">•</span>
                      <span>Veracidade — não compartilhe informações falsas, enganosas ou fora de contexto.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-red-veon flex-shrink-0 mt-0.5">•</span>
                      <span>Direitos autorais — respeite a propriedade intelectual de terceiros.</span>
                    </li>
                  </ul>
                  <p className="text-xs text-text-muted mt-3 pt-3 border-t border-navy-800">
                    Se você acredita que este post foi removido por engano, entre em contato com um gestor da comunidade.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-navy-800">
              <button
                onClick={() => setBlockedModal(null)}
                className="w-full bg-red-veon hover:bg-red-veon-dark text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
