import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Bell, User, Heart, MessageCircle, UserPlus, Share2, FileText, BookOpen, Sparkles, Wallet, X } from 'lucide-react'

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
}

export function NotificationsBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
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

      return data.map((n: any) => ({
        ...n,
        actor: n.actor_id ? actorsMap.get(n.actor_id) : null,
        training: n.training_id ? trainingsMap.get(n.training_id) : null,
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
            const extra = n.training?.title || undefined

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
    </div>
  )
}
