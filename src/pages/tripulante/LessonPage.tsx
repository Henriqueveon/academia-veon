import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Heart, CheckCircle, SkipBack, SkipForward,
  Send, Trash2, User, MessageCircle, Reply, X,
} from 'lucide-react'
import { VideoPlayer } from '../../components/VideoPlayer'

function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/)
  return match ? match[1] : null
}

export function LessonPage() {
  const { id: trainingId, lessonId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
  const openTimeRef = useRef(Date.now())
  const viewIdRef = useRef<string | null>(null)

  // ── Data fetching ──────────────────────────────────────

  const { data: training } = useQuery({
    queryKey: ['training-info', trainingId],
    queryFn: async () => {
      const { data } = await supabase.from('trainings').select('*').eq('id', trainingId!).single()
      return data
    },
    enabled: !!trainingId,
  })

  // All lessons in this training (flat, ordered by module then lesson sort)
  const { data: allLessons = [], isLoading } = useQuery({
    queryKey: ['training-all-lessons', trainingId, user?.id],
    queryFn: async () => {
      const { data: modules } = await supabase
        .from('modules')
        .select('*')
        .eq('training_id', trainingId!)
        .order('sort_order')
      if (!modules?.length) return []

      const moduleIds = modules.map(m => m.id)
      const { data: lessons } = await supabase
        .from('lessons')
        .select('*')
        .in('module_id', moduleIds)
        .order('sort_order')

      const { data: progress } = await supabase
        .from('lesson_progress')
        .select('lesson_id, watched')
        .eq('user_id', user!.id)

      const progressMap = new Map((progress || []).map((p: any) => [p.lesson_id, p.watched]))
      const moduleMap = new Map(modules.map(m => [m.id, m]))

      return (lessons || []).map((l: any) => ({
        ...l,
        watched: progressMap.get(l.id) || false,
        moduleName: moduleMap.get(l.module_id)?.title || '',
      }))
    },
    enabled: !!user && !!trainingId,
  })

  const lesson = allLessons.find((l: any) => l.id === lessonId)
  const currentIndex = allLessons.findIndex((l: any) => l.id === lessonId)
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null

  // ── Likes ──────────────────────────────────────────────

  const { data: likes = [] } = useQuery({
    queryKey: ['lesson-likes', lessonId],
    queryFn: async () => {
      const { data } = await supabase
        .from('lesson_likes')
        .select('id, user_id')
        .eq('lesson_id', lessonId!)
      if (!data?.length) return []

      const userIds = [...new Set(data.map((l: any) => l.user_id))]
      const { data: profiles } = await supabase.from('profiles').select('id, name, avatar_url').in('id', userIds)
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

      return data.map((l: any) => ({ ...l, profile: profileMap.get(l.user_id) || null }))
    },
    enabled: !!lessonId,
  })

  const myLike = likes.find((l: any) => l.user_id === user?.id)
  const likeCount = likes.length

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (myLike) {
        const { error } = await supabase.from('lesson_likes').delete().eq('id', myLike.id)
        if (error) { console.error('Unlike error:', error); throw error }
      } else {
        const { error } = await supabase.from('lesson_likes').insert({ lesson_id: lessonId, user_id: user!.id })
        if (error) { console.error('Like error:', error); throw error }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lesson-likes', lessonId] }),
  })

  // ── Comments ───────────────────────────────────────────

  const [commentText, setCommentText] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null)

  const { data: allComments = [] } = useQuery({
    queryKey: ['lesson-comments', lessonId],
    queryFn: async () => {
      // Try with parent_id first, fallback without it
      let { data, error } = await supabase
        .from('lesson_comments')
        .select('id, body, created_at, user_id, parent_id')
        .eq('lesson_id', lessonId!)
        .order('created_at', { ascending: true })
      if (error) {
        const res = await supabase
          .from('lesson_comments')
          .select('id, body, created_at, user_id')
          .eq('lesson_id', lessonId!)
          .order('created_at', { ascending: true })
        data = (res.data || []).map((c: any) => ({ ...c, parent_id: null })) as any
      }
      if (!data?.length) return []

      const userIds = [...new Set(data.map((c: any) => c.user_id))]
      const { data: profiles } = await supabase.from('profiles').select('id, name, avatar_url').in('id', userIds)
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

      return data.map((c: any) => ({ ...c, profile: profileMap.get(c.user_id) || null }))
    },
    enabled: !!lessonId,
  })

  // Split into root comments and replies
  const rootComments = allComments.filter((c: any) => !c.parent_id)
  const repliesMap = new Map<string, any[]>()
  allComments.filter((c: any) => c.parent_id).forEach((c: any) => {
    const arr = repliesMap.get(c.parent_id) || []
    arr.push(c)
    repliesMap.set(c.parent_id, arr)
  })

  const addComment = useMutation({
    mutationFn: async () => {
      const text = commentText.trim()
      if (!text) return
      const row: any = { lesson_id: lessonId, user_id: user!.id, body: text }
      if (replyTo?.id) row.parent_id = replyTo.id
      const { error } = await supabase.from('lesson_comments').insert(row)
      if (error) { console.error('Comment insert error:', error); throw error }
    },
    onSuccess: () => {
      setCommentText('')
      setReplyTo(null)
      queryClient.invalidateQueries({ queryKey: ['lesson-comments', lessonId] })
    },
  })

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('lesson_comments').delete().eq('id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lesson-comments', lessonId] }),
  })

  // ── Progress ───────────────────────────────────────────

  const markWatched = useMutation({
    mutationFn: async () => {
      await supabase.from('lesson_progress').upsert({
        user_id: user!.id,
        lesson_id: lessonId!,
        watched: true,
        watched_at: new Date().toISOString(),
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['training-all-lessons'] }),
  })

  const unmarkWatched = useMutation({
    mutationFn: async () => {
      await supabase.from('lesson_progress').upsert({
        user_id: user!.id,
        lesson_id: lessonId!,
        watched: false,
        watched_at: null,
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['training-all-lessons'] }),
  })

  // ── View logging ───────────────────────────────────────

  useEffect(() => {
    if (!user || !lessonId) return
    openTimeRef.current = Date.now()
    viewIdRef.current = null
    ;(async () => {
      const { data } = await supabase
        .from('lesson_views')
        .insert({ user_id: user.id, lesson_id: lessonId })
        .select('id')
        .single()
      if (data) viewIdRef.current = data.id
    })()
  }, [user, lessonId])

  const saveViewDuration = useCallback(async () => {
    const elapsed = Math.round((Date.now() - openTimeRef.current) / 1000)
    if (viewIdRef.current) {
      await supabase
        .from('lesson_views')
        .update({ duration_seconds: elapsed })
        .eq('id', viewIdRef.current)
    }
  }, [])

  // Save duration on unmount
  useEffect(() => {
    return () => { saveViewDuration() }
  }, [saveViewDuration])

  // ── Navigation helpers ─────────────────────────────────

  function goToLesson(l: any) {
    saveViewDuration()
    navigate(`/treinamentos/${trainingId}/aula/${l.id}`, { replace: true })
  }

  // ── Render ─────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-red-veon border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!lesson) {
    return (
      <div className="py-20 text-center text-text-muted">
        <p>Aula não encontrada.</p>
        <button onClick={() => navigate(`/treinamentos/${trainingId}`)} className="text-red-veon mt-4">
          Voltar ao treinamento
        </button>
      </div>
    )
  }

  const ytId = lesson.youtube_url ? extractYoutubeId(lesson.youtube_url) : null
  const bunnyId = lesson.bunny_video_id

  return (
    <div className="-mx-4 -mb-4 md:-mx-8 md:-mb-8 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-8 py-5 border-b border-white/10">
        <img src="/veon-logo.png" alt="Instituto Veon" className="h-[46px] md:h-[55px] object-contain" />
        <span className="text-base md:text-lg font-bold italic text-white/90 tracking-wide">A Escola do Varejo</span>
      </div>

      {/* Back */}
      <div className="px-4 md:px-8 pt-4">
        <button
          onClick={() => { saveViewDuration(); navigate(`/treinamentos/${trainingId}`) }}
          className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar — {training?.title || 'Treinamento'}
        </button>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-4 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-0">

          {/* Left: Video + info */}
          <div className="lg:pr-6">
            {/* Title above video, left-aligned */}
            <h1 className="text-lg md:text-xl font-bold text-white uppercase">{lesson.title}</h1>
            <p className="text-xs text-text-muted mb-3">{lesson.moduleName}</p>

            {/* Video with red border */}
            <div className="bg-[#0F1F42]/80 border-2 border-red-veon/40 rounded-xl overflow-hidden">
              {bunnyId ? (
                <VideoPlayer videoId={bunnyId} autoplay />
              ) : ytId ? (
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
                    title={lesson.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="aspect-video flex items-center justify-center text-text-muted">
                  Vídeo não disponível
                </div>
              )}
            </div>

            {/* Description */}
            {lesson.description && (
              <p className="text-text-secondary mt-4 text-sm">{lesson.description}</p>
            )}

            {/* Material */}
            {lesson.material_url && (
              <a
                href={lesson.material_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-navy-800 hover:bg-navy-700 text-text-secondary hover:text-white text-sm px-4 py-2 rounded-lg transition-colors mt-3 border border-navy-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                {lesson.material_name || 'Material de Apoio'}
              </a>
            )}

            {/* Action bar: complete + nav left, like right */}
            <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
              {/* Left: nav + complete */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => prevLesson && goToLesson(prevLesson)}
                  disabled={!prevLesson}
                  className={`flex items-center gap-1.5 text-sm px-3 py-2.5 rounded-lg transition-colors ${
                    prevLesson
                      ? 'bg-bg-card border border-navy-700 text-text-secondary hover:text-white hover:border-navy-600'
                      : 'bg-bg-card/50 text-text-muted/30 cursor-not-allowed border border-navy-800/50'
                  }`}
                >
                  <SkipBack className="w-4 h-4" /> <span className="hidden sm:inline">Anterior</span>
                </button>

                {lesson.watched ? (
                  <button
                    onClick={() => unmarkWatched.mutate()}
                    className="flex items-center gap-2 bg-red-veon/20 border border-red-veon/30 text-red-veon text-sm px-4 py-2.5 rounded-lg transition-colors group/btn"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span className="group-hover/btn:hidden">Concluída</span>
                    <span className="hidden group-hover/btn:inline">Desmarcar</span>
                  </button>
                ) : (
                  <button
                    onClick={() => markWatched.mutate()}
                    className="flex items-center gap-2 bg-red-veon hover:bg-red-veon-dark text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" /> Concluir aula
                  </button>
                )}

                <button
                  onClick={() => nextLesson && goToLesson(nextLesson)}
                  disabled={!nextLesson}
                  className={`flex items-center gap-1.5 text-sm px-3 py-2.5 rounded-lg transition-colors ${
                    nextLesson
                      ? 'bg-bg-card border border-navy-700 text-text-secondary hover:text-white hover:border-navy-600'
                      : 'bg-bg-card/50 text-text-muted/30 cursor-not-allowed border border-navy-800/50'
                  }`}
                >
                  <span className="hidden sm:inline">Próxima</span> <SkipForward className="w-4 h-4" />
                </button>
              </div>

              {/* Right: Like */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleLike.mutate()}
                  className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg border transition-colors ${
                    myLike
                      ? 'bg-red-veon/20 border-red-veon/40 text-red-veon'
                      : 'bg-bg-card border-navy-700 text-text-secondary hover:text-red-veon hover:border-red-veon/40'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${myLike ? 'fill-red-veon' : ''}`} />
                  {likeCount > 0 && <span>{likeCount}</span>}
                  <span className="hidden sm:inline">{myLike ? 'Curtido' : 'Curtir'}</span>
                </button>

                {/* Liked avatars */}
                {likes.length > 0 && (
                  <div className="flex -space-x-2">
                    {likes.slice(0, 5).map((l: any) => (
                      <div key={l.id} className="w-6 h-6 rounded-full border-2 border-bg-primary overflow-hidden bg-navy-800" title={l.profile?.name}>
                        {l.profile?.avatar_url ? (
                          <img src={(l as any).profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="w-3 h-3 text-text-muted" />
                          </div>
                        )}
                      </div>
                    ))}
                    {likes.length > 5 && (
                      <span className="text-xs text-text-muted ml-2">+{likes.length - 5}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Comments — linha vermelha */}
          <aside className="lg:border-l lg:border-red-veon/40 lg:pl-6 mt-8 lg:mt-0 pt-8 lg:pt-0 border-t lg:border-t-0 border-red-veon/40">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="w-5 h-5 text-red-veon" />
              <h2 className="text-base font-semibold text-white">Comentários</h2>
            </div>
            <p className="text-xs text-text-muted mb-5">
              Ficou com dúvidas na aula? Faça um comentário e obtenha sua resposta.
            </p>

            {/* Reply indicator */}
            {replyTo && (
              <div className="flex items-center gap-2 mb-2 bg-navy-800/50 rounded-lg px-3 py-2">
                <Reply className="w-3.5 h-3.5 text-red-veon" />
                <span className="text-xs text-text-secondary">Respondendo a <span className="font-semibold text-text-primary">{replyTo.name}</span></span>
                <button onClick={() => setReplyTo(null)} className="ml-auto text-text-muted hover:text-text-primary">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Comment input */}
            <div className="flex gap-2 mb-6">
              <div className="w-8 h-8 rounded-full bg-navy-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {(profile as any)?.avatar_url ? (
                  <img src={(profile as any).avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-text-muted" />
                )}
              </div>
              <div className="flex-1 flex gap-2">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && commentText.trim()) addComment.mutate() }}
                  placeholder={replyTo ? `Responder ${replyTo.name}...` : 'Escreva um comentário...'}
                  className="flex-1 bg-bg-input border border-navy-700 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-red-veon"
                />
                <button
                  onClick={() => addComment.mutate()}
                  disabled={!commentText.trim() || addComment.isPending}
                  className="bg-red-veon hover:bg-red-veon-dark text-white p-2.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Comments list */}
            <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {rootComments.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-8">
                  Nenhum comentário ainda. Seja o primeiro!
                </p>
              ) : (
                rootComments.map((c: any) => {
                  const isOwn = c.user_id === user?.id
                  const isGestor = profile?.role === 'gestor'
                  const authorName = c.profile?.name || 'Aluno'
                  const replies = repliesMap.get(c.id) || []

                  return (
                    <div key={c.id}>
                      {/* Parent comment */}
                      <div className="flex gap-2.5 group">
                        <div className="w-7 h-7 rounded-full bg-navy-800 overflow-hidden flex-shrink-0 flex items-center justify-center mt-0.5">
                          {c.profile?.avatar_url ? (
                            <img src={c.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-3.5 h-3.5 text-text-muted" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-text-primary">{authorName}</span>
                            <span className="text-[10px] text-text-muted">{formatTime(c.created_at)}</span>
                          </div>
                          <p className="text-sm text-text-secondary mt-0.5 break-words">{c.body}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <button
                              onClick={() => setReplyTo({ id: c.id, name: authorName })}
                              className="flex items-center gap-1 text-[11px] text-text-muted hover:text-red-veon transition-colors"
                            >
                              <Reply className="w-3 h-3" /> Responder
                            </button>
                            {(isOwn || isGestor) && (
                              <button
                                onClick={() => deleteComment.mutate(c.id)}
                                className="flex items-center gap-1 text-[11px] text-text-muted hover:text-red-veon transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-3 h-3" /> Excluir
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Replies nested */}
                      {replies.length > 0 && (
                        <div className="ml-9 mt-2 pl-3 border-l-2 border-red-veon/20 space-y-3">
                          {replies.map((r: any) => {
                            const rOwn = r.user_id === user?.id
                            const rName = r.profile?.name || 'Aluno'
                            return (
                              <div key={r.id} className="flex gap-2 group/reply">
                                <div className="w-6 h-6 rounded-full bg-navy-800 overflow-hidden flex-shrink-0 flex items-center justify-center mt-0.5">
                                  {r.profile?.avatar_url ? (
                                    <img src={r.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <User className="w-3 h-3 text-text-muted" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-semibold text-text-primary">{rName}</span>
                                    <span className="text-[10px] text-text-muted">{formatTime(r.created_at)}</span>
                                  </div>
                                  <p className="text-xs text-text-secondary mt-0.5 break-words">{r.body}</p>
                                  <div className="flex items-center gap-3 mt-0.5">
                                    <button
                                      onClick={() => setReplyTo({ id: c.id, name: rName })}
                                      className="flex items-center gap-1 text-[10px] text-text-muted hover:text-red-veon transition-colors"
                                    >
                                      <Reply className="w-2.5 h-2.5" /> Responder
                                    </button>
                                    {(rOwn || isGestor) && (
                                      <button
                                        onClick={() => deleteComment.mutate(r.id)}
                                        className="flex items-center gap-1 text-[10px] text-text-muted hover:text-red-veon transition-colors opacity-0 group-hover/reply:opacity-100"
                                      >
                                        <Trash2 className="w-2.5 h-2.5" /> Excluir
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
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
