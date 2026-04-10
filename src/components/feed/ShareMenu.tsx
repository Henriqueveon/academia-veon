import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { X, Users, MessageCircle, Instagram, Facebook, Check, Search, Send, User } from 'lucide-react'

interface Props {
  post: any
  onClose: () => void
}

export function ShareMenu({ post, onClose }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<'options' | 'internal'>('options')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [sent, setSent] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const publicUrl = `${window.location.origin}/p/${post.id}${user ? `?ref=${user.id}` : ''}`

  // Copy link on mount
  useState(() => {
    navigator.clipboard.writeText(publicUrl).then(() => setLinkCopied(true)).catch(() => {})
  })

  // Fetch following list, or suggestions if few following
  const { data: candidates = [] } = useQuery({
    queryKey: ['share-candidates', user?.id],
    queryFn: async () => {
      // Who I follow
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user!.id)
      const followingIds = (follows || []).map((f: any) => f.following_id)

      // Get their profiles
      let profiles: any[] = []
      if (followingIds.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, name, avatar_url, profession')
          .in('id', followingIds)
        profiles = data || []
      }

      // If few, also fetch suggestions (other users, excluding self + already following)
      if (profiles.length < 10) {
        const excludeIds = [...followingIds, user!.id]
        const { data: suggestions } = await supabase
          .from('profiles')
          .select('id, name, avatar_url, profession')
          .not('id', 'in', `(${excludeIds.join(',')})`)
          .limit(20 - profiles.length)
        if (suggestions) {
          profiles = [
            ...profiles.map((p: any) => ({ ...p, _following: true })),
            ...suggestions.map((p: any) => ({ ...p, _following: false })),
          ]
        }
      } else {
        profiles = profiles.map((p: any) => ({ ...p, _following: true }))
      }

      return profiles
    },
    enabled: !!user && step === 'internal',
  })

  const filtered = candidates.filter((c: any) =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  )

  const shareMutation = useMutation({
    mutationFn: async () => {
      const rows = selectedIds.map((id) => ({
        post_id: post.id,
        sender_id: user!.id,
        recipient_id: id,
      }))
      await supabase.from('post_shares').insert(rows)
      // Create notifications
      await Promise.all(
        selectedIds.map((recipientId) =>
          supabase.rpc('create_notification', {
            target_user_id: recipientId,
            actor_user_id: user!.id,
            notif_type: 'share_received',
            p_post_id: post.id,
          })
        )
      )
    },
    onSuccess: () => {
      setSent(true)
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setTimeout(() => onClose(), 1500)
    },
  })

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function shareWhatsApp() {
    const text = `Olha esse post da Academia Veon: ${publicUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  function shareFacebook() {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`, '_blank')
  }

  async function shareInstagramStories() {
    // Try native share (works on mobile and offers Stories option)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Academia Veon',
          text: 'Confira esse post',
          url: publicUrl,
        })
      } catch {}
    } else {
      // Desktop: open Instagram with URL copied to clipboard
      await navigator.clipboard.writeText(publicUrl)
      alert('Link copiado! Abra o Instagram e cole no seu story.')
      window.open('https://www.instagram.com/', '_blank')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-bg-card border border-navy-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-navy-800">
          <h2 className="text-lg font-semibold">
            {step === 'options' ? 'Compartilhar' : 'Enviar para...'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Link copied indicator */}
        {linkCopied && step === 'options' && (
          <div className="mx-4 mt-3 bg-green-900/20 border border-green-800/50 text-green-400 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
            <Check className="w-3.5 h-3.5" /> Link copiado!
          </div>
        )}

        {/* Options */}
        {step === 'options' && (
          <div className="p-6">
            <div className="grid grid-cols-4 gap-3">
              <button
                onClick={() => setStep('internal')}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-veon to-red-veon-dark flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs text-text-secondary text-center leading-tight">Amigos</span>
              </button>

              <button
                onClick={shareWhatsApp}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs text-text-secondary text-center leading-tight">WhatsApp</span>
              </button>

              <button
                onClick={shareInstagramStories}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                  <Instagram className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs text-text-secondary text-center leading-tight">Instagram</span>
              </button>

              <button
                onClick={shareFacebook}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                  <Facebook className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs text-text-secondary text-center leading-tight">Facebook</span>
              </button>
            </div>
          </div>
        )}

        {/* Internal share */}
        {step === 'internal' && (
          <>
            <div className="p-4 border-b border-navy-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-bg-input border border-navy-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-red-veon"
                  placeholder="Buscar aluno..."
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-2">
              {filtered.length === 0 ? (
                <p className="text-center text-text-muted py-8 text-sm">Nenhum aluno encontrado.</p>
              ) : (
                filtered.map((c: any) => {
                  const isSelected = selectedIds.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleSelect(c.id)}
                      className="w-full flex items-center gap-3 p-2.5 hover:bg-navy-800 rounded-lg transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-navy-900 flex items-center justify-center flex-shrink-0">
                        {c.avatar_url ? (
                          <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-5 h-5 text-text-muted" />
                        )}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{c.name}</p>
                        <p className="text-xs text-text-muted truncate">
                          {c._following ? 'Seguindo' : 'Sugestão'}
                          {c.profession && ` · ${c.profession}`}
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-red-veon border-red-veon' : 'border-navy-600'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            <div className="p-4 border-t border-navy-800 flex gap-2">
              <button onClick={() => setStep('options')} className="flex-1 bg-bg-input text-text-secondary hover:text-text-primary py-2.5 rounded-lg text-sm">
                Voltar
              </button>
              <button
                onClick={() => shareMutation.mutate()}
                disabled={selectedIds.length === 0 || shareMutation.isPending || sent}
                className="flex-1 bg-red-veon hover:bg-red-veon-dark text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sent ? (
                  <><Check className="w-4 h-4" /> Enviado!</>
                ) : shareMutation.isPending ? 'Enviando...' : (
                  <><Send className="w-4 h-4" /> Enviar ({selectedIds.length})</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
