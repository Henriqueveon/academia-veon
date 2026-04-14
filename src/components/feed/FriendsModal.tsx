import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { X, Search, User, Eye, UserPlus, UserCheck, Users } from 'lucide-react'

interface Props {
  onClose: () => void
}

export function FriendsModal({ onClose }: Props) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['community-users', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, profession')
        .neq('id', user!.id)
        .order('name')
      return data || []
    },
    enabled: !!user,
  })

  const { data: followingIds = new Set<string>() } = useQuery({
    queryKey: ['my-following', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user!.id)
      return new Set<string>((data || []).map((f: any) => f.following_id))
    },
    enabled: !!user,
  })

  const toggleFollow = useMutation({
    mutationFn: async ({ targetId, currentlyFollowing }: { targetId: string; currentlyFollowing: boolean }) => {
      if (currentlyFollowing) {
        await supabase.from('follows').delete().eq('follower_id', user!.id).eq('following_id', targetId)
      } else {
        await supabase.from('follows').insert({ follower_id: user!.id, following_id: targetId })
      }
    },
    onMutate: async ({ targetId, currentlyFollowing }) => {
      await queryClient.cancelQueries({ queryKey: ['my-following', user?.id] })
      const prev = queryClient.getQueryData<Set<string>>(['my-following', user?.id])
      const next = new Set<string>(prev || [])
      if (currentlyFollowing) next.delete(targetId)
      else next.add(targetId)
      queryClient.setQueryData(['my-following', user?.id], next)
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['my-following', user?.id], ctx.prev)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-social'] })
    },
  })

  const filtered = search.trim()
    ? users.filter((u: any) =>
        (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.profession || '').toLowerCase().includes(search.toLowerCase())
      )
    : users

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
        ref={modalRef}
        className="bg-bg-card border border-navy-800 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-navy-800">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-red-veon" />
            <h2 className="text-lg font-semibold text-text-primary">Comunidade</h2>
            <span className="text-xs text-text-muted">({users.length})</span>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 border-b border-navy-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full bg-bg-input border border-navy-700 rounded-lg pl-10 pr-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-red-veon"
              placeholder="Buscar aluno..."
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="py-12 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-red-veon border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-text-muted">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">
                {search ? 'Nenhum aluno encontrado.' : 'Ainda não há alunos cadastrados.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-navy-800/50">
              {filtered.map((u: any) => {
                const isFollowing = followingIds.has(u.id)
                return (
                  <div key={u.id} className="flex items-center gap-3 p-3 hover:bg-navy-800/50 transition-colors">
                    <button
                      onClick={() => handleViewProfile(u.id)}
                      className="w-11 h-11 rounded-full overflow-hidden bg-navy-900 flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity"
                    >
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <User className="w-5 h-5 text-text-muted" />
                      )}
                    </button>

                    <button
                      onClick={() => handleViewProfile(u.id)}
                      className="flex-1 text-left min-w-0 hover:opacity-80"
                    >
                      <p className="text-sm font-medium text-text-primary truncate">{u.name}</p>
                      {u.profession && (
                        <p className="text-xs text-text-muted truncate">{u.profession}</p>
                      )}
                    </button>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleViewProfile(u.id)}
                        className="p-2 text-text-muted hover:text-text-primary bg-navy-800 hover:bg-navy-700 rounded-lg transition-colors"
                        title="Ver perfil"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleFollow.mutate({ targetId: u.id, currentlyFollowing: isFollowing })}
                        disabled={toggleFollow.isPending}
                        className={`p-2 rounded-lg transition-colors ${
                          isFollowing
                            ? 'bg-green-900/30 text-green-400 hover:bg-red-900/30 hover:text-red-veon'
                            : 'bg-red-veon hover:bg-red-veon-dark text-white'
                        }`}
                        title={isFollowing ? 'Deixar de seguir' : 'Seguir'}
                      >
                        {isFollowing ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
