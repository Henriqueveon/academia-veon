import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { X, User, Heart } from 'lucide-react'

interface Props {
  postId: string
  onClose: () => void
}

export function LikesModal({ postId, onClose }: Props) {
  const navigate = useNavigate()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const { data: likes = [], isLoading } = useQuery({
    queryKey: ['post-likes-list', postId],
    queryFn: async () => {
      const { data: likesData } = await supabase
        .from('post_likes')
        .select('user_id, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: false })

      if (!likesData || likesData.length === 0) return []

      const userIds = likesData.map((l: any) => l.user_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, profession')
        .in('id', userIds)

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

      return likesData.map((l: any) => ({
        user_id: l.user_id,
        created_at: l.created_at,
        profile: profileMap.get(l.user_id),
      }))
    },
  })

  function handleViewProfile(id: string) {
    onClose()
    navigate(`/perfil/${id}`)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-navy-800 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-navy-800">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-veon fill-red-veon" />
            <h2 className="text-lg font-semibold text-text-primary">Curtidas</h2>
            {likes.length > 0 && (
              <span className="text-xs text-text-muted">({likes.length})</span>
            )}
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="py-12 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-red-veon border-t-transparent rounded-full animate-spin" />
            </div>
          ) : likes.length === 0 ? (
            <div className="py-12 text-center text-text-muted">
              <Heart className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Nenhuma curtida ainda</p>
            </div>
          ) : (
            <div className="divide-y divide-navy-800/50">
              {likes.map((l: any) => {
                const profile = l.profile
                const name = profile?.name || '—'
                return (
                  <button
                    key={l.user_id}
                    onClick={() => handleViewProfile(l.user_id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-navy-800/50 transition-colors text-left"
                  >
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-navy-900 flex items-center justify-center flex-shrink-0">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <User className="w-5 h-5 text-text-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{name}</p>
                      {profile?.profession && (
                        <p className="text-xs text-text-muted truncate">{profile.profession}</p>
                      )}
                    </div>
                    <Heart className="w-4 h-4 text-red-veon fill-red-veon flex-shrink-0" />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
