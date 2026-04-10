import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useImageUpload } from '../../hooks/useImageUpload'
import { Camera, Check, User, Pencil, X, Image as ImageIcon, Video, Mic, Grid3x3, ArrowLeft, ImagePlus, Move, UserPlus, UserCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PostCard } from '../../components/feed/PostCard'

const BIO_MAX = 150

export function ProfilePage() {
  const { user } = useAuth()
  const { userId: paramUserId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const { uploadImage, uploading } = useImageUpload()

  // The profile being viewed (own or someone else's)
  const profileUserId = paramUserId || user?.id
  const isOwn = profileUserId === user?.id

  const [form, setForm] = useState({ name: '', avatar_url: '', cover_url: '', cover_position: 50, profession: '', bio: '' })
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selectedPost, setSelectedPost] = useState<any>(null)
  const coverFileRef = useRef<HTMLInputElement>(null)
  const [repositioning, setRepositioning] = useState(false)
  const dragStartRef = useRef<{ y: number; startPos: number } | null>(null)

  // Load profile being viewed
  useEffect(() => {
    if (!profileUserId) return
    setEditing(false)
    ;(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('name, avatar_url, cover_url, cover_position, profession, bio')
        .eq('id', profileUserId)
        .single()
      if (data) setForm({
        name: data.name || '',
        avatar_url: data.avatar_url || '',
        cover_url: data.cover_url || '',
        cover_position: data.cover_position ?? 50,
        profession: data.profession || '',
        bio: data.bio || '',
      })
    })()
  }, [profileUserId])

  // Stats
  const { data: stats } = useQuery({
    queryKey: ['profile-stats', profileUserId],
    queryFn: async () => {
      const { data: trns } = await supabase.from('trainings').select('id')
      const { data: completed } = await supabase
        .from('lesson_progress').select('lesson_id, watched_at')
        .eq('user_id', profileUserId!).eq('watched', true)
      const { data: views } = await supabase
        .from('lesson_views').select('viewed_at')
        .eq('user_id', profileUserId!)
        .order('viewed_at', { ascending: false }).limit(1)

      const lastView = views?.[0]?.viewed_at || null
      const lastProgress = completed?.length
        ? completed.sort((a: any, b: any) => new Date(b.watched_at).getTime() - new Date(a.watched_at).getTime())[0]?.watched_at
        : null
      let lastActivity: string | null = null
      if (lastView && lastProgress) lastActivity = new Date(lastView) > new Date(lastProgress) ? lastView : lastProgress
      else lastActivity = lastView || lastProgress

      return {
        trainings: trns?.length || 0,
        completed: completed?.length || 0,
        lastActivity,
      }
    },
    enabled: !!profileUserId,
  })

  // User's posts
  const { data: userPosts = [] } = useQuery({
    queryKey: ['user-posts', profileUserId],
    queryFn: async () => {
      const { data: posts } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', profileUserId!)
        .order('created_at', { ascending: false })
      if (!posts?.length) return []

      const postIds = posts.map((p: any) => p.id)
      const { data: pages } = await supabase
        .from('post_pages')
        .select('*')
        .in('post_id', postIds)
        .order('sort_order')

      return posts.map((p: any) => ({
        ...p,
        pages: (pages || []).filter((pg: any) => pg.post_id === p.id),
      }))
    },
    enabled: !!profileUserId,
  })

  // Following status (when viewing another profile)
  const { data: isFollowing = false } = useQuery({
    queryKey: ['follow', profileUserId, user?.id],
    queryFn: async () => {
      if (!user || isOwn || !profileUserId) return false
      const { data } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', user.id)
        .eq('following_id', profileUserId)
        .maybeSingle()
      return !!data
    },
    enabled: !!user && !isOwn && !!profileUserId,
  })

  const toggleFollow = useMutation({
    mutationFn: async () => {
      if (isFollowing) {
        await supabase.from('follows').delete().eq('follower_id', user!.id).eq('following_id', profileUserId!)
      } else {
        await supabase.from('follows').insert({ follower_id: user!.id, following_id: profileUserId! })
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['follow', profileUserId, user?.id] })
      const prev = queryClient.getQueryData(['follow', profileUserId, user?.id])
      queryClient.setQueryData(['follow', profileUserId, user?.id], !isFollowing)
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) queryClient.setQueryData(['follow', profileUserId, user?.id], ctx.prev)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-social', profileUserId] })
    },
  })

  // Social stats: total likes received, followers, following
  const { data: socialStats } = useQuery({
    queryKey: ['profile-social', profileUserId],
    queryFn: async () => {
      // All posts of this user
      const { data: userPostList } = await supabase
        .from('posts')
        .select('id')
        .eq('user_id', profileUserId!)
      const postIds = (userPostList || []).map((p: any) => p.id)

      // Total likes received on posts
      let totalLikes = 0
      if (postIds.length > 0) {
        const { count } = await supabase
          .from('post_likes')
          .select('*', { count: 'exact', head: true })
          .in('post_id', postIds)
        totalLikes = count || 0
      }

      // Followers / Following
      const { count: followersCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', profileUserId!)
      const { count: followingCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', profileUserId!)

      return {
        likes: totalLikes,
        followers: followersCount || 0,
        following: followingCount || 0,
      }
    },
    enabled: !!profileUserId,
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('profiles').update({
        name: form.name.trim(),
        avatar_url: form.avatar_url || null,
        cover_url: form.cover_url || null,
        profession: form.profession.trim() || null,
        bio: form.bio.trim() || null,
      }).eq('id', user!.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      setSaved(true)
      setEditing(false)
      setTimeout(() => setSaved(false), 3000)
      window.location.reload()
    },
  })

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await uploadImage(file, 'avatars')
    if (url) {
      setForm(f => ({ ...f, avatar_url: url }))
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', user!.id)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await uploadImage(file, 'covers')
    if (url) {
      setForm(f => ({ ...f, cover_url: url, cover_position: 50 }))
      await supabase.from('profiles').update({ cover_url: url, cover_position: 50 }).eq('id', user!.id)
    }
    if (coverFileRef.current) coverFileRef.current.value = ''
  }

  function handleDragStart(e: React.MouseEvent | React.TouchEvent) {
    if (!repositioning) return
    e.preventDefault()
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    dragStartRef.current = { y: clientY, startPos: form.cover_position }
  }

  function handleDragMove(e: React.MouseEvent | React.TouchEvent) {
    if (!dragStartRef.current || !repositioning) return
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const deltaY = clientY - dragStartRef.current.y
    // Each pixel of drag = 0.5% position change
    const newPos = Math.max(0, Math.min(100, dragStartRef.current.startPos - deltaY * 0.5))
    setForm(f => ({ ...f, cover_position: Math.round(newPos) }))
  }

  function handleDragEnd() {
    dragStartRef.current = null
  }

  async function saveCoverPosition() {
    setRepositioning(false)
    await supabase.from('profiles').update({ cover_position: form.cover_position }).eq('id', user!.id)
  }

  function formatLastActivity(date: string | null) {
    if (!date) return 'Nunca'
    const d = new Date(date)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'Hoje'
    if (diff === 1) return 'Ontem'
    if (diff < 7) return `${diff} dias atrás`
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // Load full post data when clicking a thumbnail (for display in modal)
  async function openPost(post: any) {
    // Reuse data already loaded; fetch likes/comments fresh
    const [likes, comments, commentLikes] = await Promise.all([
      supabase.from('post_likes').select('*').eq('post_id', post.id),
      supabase.from('post_comments').select('*').eq('post_id', post.id).order('created_at'),
      supabase.from('comment_likes').select('*'),
    ])
    const commentUserIds = [...new Set((comments.data || []).map((c: any) => c.user_id))]
    const { data: commentProfiles } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .in('id', commentUserIds.length > 0 ? commentUserIds : ['none'])
    const profileMap = new Map((commentProfiles || []).map((p: any) => [p.id, p]))

    setSelectedPost({
      ...post,
      author: { name: form.name, avatar_url: form.avatar_url, profession: form.profession },
      likes: likes.data || [],
      likedByMe: (likes.data || []).some((l: any) => l.user_id === user?.id),
      likesCount: (likes.data || []).length,
      comments: (comments.data || []).map((c: any) => ({
        ...c,
        author: profileMap.get(c.user_id) || { name: '—', avatar_url: null },
        likesCount: (commentLikes.data || []).filter((cl: any) => cl.comment_id === c.id).length,
        likedByMe: (commentLikes.data || []).some((cl: any) => cl.comment_id === c.id && cl.user_id === user?.id),
      })),
      commentsCount: (comments.data || []).length,
    })
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Back button when viewing other profile */}
      {!isOwn && (
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-text-muted hover:text-text-primary mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
      )}

      {/* Profile card */}
      <div className="bg-bg-card border border-navy-800 rounded-2xl overflow-hidden">
        {/* Cover */}
        <div
          className={`relative h-32 group overflow-hidden ${repositioning ? 'cursor-grab active:cursor-grabbing select-none' : ''}`}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          {form.cover_url ? (
            <img
              src={form.cover_url}
              alt="Capa"
              draggable={false}
              className="w-full h-full object-cover"
              style={{ objectPosition: `center ${form.cover_position}%` }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-red-veon/30 via-navy-900 to-red-veon/10" />
          )}

          {/* Repositioning overlay */}
          {repositioning && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
              <div className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5" /> Arraste para reposicionar
              </div>
            </div>
          )}

          {isOwn && (
            <>
              {/* Action buttons */}
              {!repositioning ? (
                <div className="absolute top-3 right-3 flex gap-2">
                  {form.cover_url && (
                    <button
                      onClick={() => setRepositioning(true)}
                      className="bg-black/60 hover:bg-black/80 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors backdrop-blur-sm"
                    >
                      <Move className="w-3.5 h-3.5" /> Reposicionar
                    </button>
                  )}
                  <button
                    onClick={() => coverFileRef.current?.click()}
                    disabled={uploading}
                    className="bg-black/60 hover:bg-black/80 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors backdrop-blur-sm"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    {form.cover_url ? 'Alterar' : 'Adicionar capa'}
                  </button>
                </div>
              ) : (
                <div className="absolute top-3 right-3 flex gap-2">
                  <button
                    onClick={saveCoverPosition}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" /> Salvar
                  </button>
                </div>
              )}
              <input ref={coverFileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleCoverUpload} className="hidden" />
            </>
          )}
        </div>

        {/* Avatar + Social stats (Instagram style) */}
        <div className="px-6 -mt-14">
          <div className="flex items-end gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-bg-card bg-navy-900 flex items-center justify-center">
                {form.avatar_url ? (
                  <img src={form.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-text-muted" />
                )}
              </div>
              {isOwn && (
                <>
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="absolute bottom-1 right-1 bg-red-veon hover:bg-red-veon-dark text-white p-2 rounded-full transition-colors shadow-lg disabled:opacity-50"
                  >
                    {uploading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </button>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} className="hidden" />
                </>
              )}
            </div>

            {/* Social stats inline (Instagram style) */}
            <div className="flex-1 flex justify-around items-center pb-3">
              <div className="text-center">
                <p className="text-lg font-bold text-text-primary leading-tight">{socialStats?.likes ?? '—'}</p>
                <p className="text-xs text-text-muted">curtidas</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-text-primary leading-tight">{socialStats?.followers ?? '—'}</p>
                <p className="text-xs text-text-muted">seguidores</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-text-primary leading-tight">{socialStats?.following ?? '—'}</p>
                <p className="text-xs text-text-muted">seguindo</p>
              </div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="px-6 pt-4 pb-2">
          <h1 className="text-xl font-bold text-text-primary">{form.name || 'Sem nome'}</h1>
          {form.profession && (
            <p className="text-sm text-text-muted mt-0.5">{form.profession}</p>
          )}
          {form.bio && (
            <p className="text-sm text-text-secondary mt-2 whitespace-pre-line leading-relaxed">{form.bio}</p>
          )}
          {!form.profession && !form.bio && isOwn && !editing && (
            <p className="text-sm text-text-muted mt-1 italic">Clique em "Editar perfil" para adicionar sua bio</p>
          )}
        </div>

        {/* Edit / Follow button */}
        <div className="px-6 pb-4">
          {isOwn ? (
            <button
              onClick={() => setEditing(!editing)}
              className={`w-full flex items-center justify-center gap-2 text-sm px-4 py-2.5 rounded-lg transition-colors ${
                editing
                  ? 'bg-navy-800 text-text-muted hover:text-text-primary'
                  : 'bg-red-veon hover:bg-red-veon-dark text-white'
              }`}
            >
              {editing ? <><X className="w-4 h-4" /> Cancelar</> : <><Pencil className="w-4 h-4" /> Editar perfil</>}
            </button>
          ) : (
            <button
              onClick={() => toggleFollow.mutate()}
              className={`w-full flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors ${
                isFollowing
                  ? 'bg-navy-800 text-text-secondary hover:bg-red-900/30 hover:text-red-veon'
                  : 'bg-red-veon hover:bg-red-veon-dark text-white'
              }`}
            >
              {isFollowing ? <><UserCheck className="w-4 h-4" /> Seguindo</> : <><UserPlus className="w-4 h-4" /> Seguir</>}
            </button>
          )}
        </div>

        {/* Academy stats bar */}
        <div className="px-6 py-4 border-t border-navy-800 flex justify-around">
          <div className="text-center">
            <p className="text-lg font-bold text-text-primary">{stats?.trainings ?? '—'}</p>
            <p className="text-xs text-text-muted">Treinamentos</p>
          </div>
          <div className="w-px bg-navy-800" />
          <div className="text-center">
            <p className="text-lg font-bold text-text-primary">{stats?.completed ?? '—'}</p>
            <p className="text-xs text-text-muted">Aulas concluídas</p>
          </div>
          {isOwn && (
            <>
              <div className="w-px bg-navy-800" />
              <div className="text-center">
                <p className="text-sm font-semibold text-text-primary">{formatLastActivity(stats?.lastActivity ?? null)}</p>
                <p className="text-xs text-text-muted">Último acesso</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Edit form */}
      {editing && isOwn && (
        <div className="bg-bg-card border border-navy-800 rounded-2xl p-6 mt-4 space-y-5">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Editar informações</h2>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Nome</label>
            <input
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-red-veon"
              placeholder="Seu nome completo"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Profissão</label>
            <input
              value={form.profession}
              onChange={(e) => setForm(f => ({ ...f, profession: e.target.value }))}
              className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-red-veon"
              placeholder="Ex: Consultor de vendas"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm text-text-secondary">Bio</label>
              <span className={`text-xs ${form.bio.length >= BIO_MAX ? 'text-red-veon' : 'text-text-muted'}`}>
                {form.bio.length}/{BIO_MAX}
              </span>
            </div>
            <textarea
              value={form.bio}
              onChange={(e) => { if (e.target.value.length <= BIO_MAX) setForm(f => ({ ...f, bio: e.target.value })) }}
              className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-red-veon resize-none"
              rows={3}
              placeholder="Conte um pouco sobre você..."
            />
          </div>

          {form.avatar_url && (
            <button
              onClick={async () => {
                setForm(f => ({ ...f, avatar_url: '' }))
                await supabase.from('profiles').update({ avatar_url: null }).eq('id', user!.id)
              }}
              className="text-xs text-text-muted hover:text-red-veon transition-colors"
            >
              Remover foto de perfil
            </button>
          )}

          <button
            onClick={() => saveMutation.mutate()}
            disabled={!form.name.trim() || saveMutation.isPending}
            className="w-full bg-red-veon hover:bg-red-veon-dark text-white font-semibold py-3 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saveMutation.isPending ? 'Salvando...' : saved ? <><Check className="w-5 h-5" /> Salvo!</> : 'Salvar'}
          </button>
        </div>
      )}

      {/* Posts grid */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3 px-1">
          <Grid3x3 className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Posts</span>
        </div>
        {userPosts.length === 0 ? (
          <div className="bg-bg-card border border-navy-800 rounded-xl py-12 text-center">
            <Grid3x3 className="w-10 h-10 text-text-muted/30 mx-auto mb-2" />
            <p className="text-sm text-text-muted">{isOwn ? 'Você ainda não fez nenhum post' : 'Nenhum post ainda'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {userPosts.map((post: any) => {
              const firstPage = post.pages[0]
              return (
                <button
                  key={post.id}
                  onClick={() => openPost(post)}
                  className="aspect-square bg-navy-900 overflow-hidden relative group"
                >
                  {firstPage?.type === 'image' && firstPage.image_url && (
                    <img src={firstPage.image_url} alt="" className="w-full h-full object-cover" />
                  )}
                  {firstPage?.type === 'video' && firstPage.image_url && (
                    <>
                      <video src={firstPage.image_url} className="w-full h-full object-cover" muted />
                      <div className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5">
                        <Video className="w-3 h-3 text-white" />
                      </div>
                    </>
                  )}
                  {firstPage?.type === 'audio' && (
                    <div className="w-full h-full bg-gradient-to-br from-green-900/50 to-navy-900 flex items-center justify-center">
                      <Mic className="w-10 h-10 text-green-400" />
                    </div>
                  )}
                  {!firstPage && (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-text-muted/30" />
                    </div>
                  )}
                  {post.pages.length > 1 && (
                    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                      {post.pages.length}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Post modal */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setSelectedPost(null)}>
          <div className="w-full max-w-lg my-8" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedPost(null)} className="absolute top-4 right-4 text-white hover:text-red-veon p-2 z-50">
              <X className="w-6 h-6" />
            </button>
            <PostCard post={selectedPost} />
          </div>
        </div>
      )}

      {/* Saved toast */}
      {saved && !editing && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-green-600 text-white text-sm px-5 py-2.5 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <Check className="w-4 h-4" /> Perfil atualizado!
        </div>
      )}
    </div>
  )
}
