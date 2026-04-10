import { useState, useRef, useEffect, forwardRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Heart, MessageCircle, ChevronLeft, ChevronRight, User, Send, Trash2, MoreHorizontal, Play, Pause, Mic, Eye, UserPlus, UserCheck, Volume2, VolumeX } from 'lucide-react'
import { ShareMenu } from './ShareMenu'

interface Props {
  post: any
}

export function PostCard({ post }: Props) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [currentPage, setCurrentPage] = useState(0)
  const [showComments, setShowComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const isOwn = post.user_id === user?.id

  // Following status
  const { data: isFollowing = false } = useQuery({
    queryKey: ['follow', post.user_id, user?.id],
    queryFn: async () => {
      if (!user || isOwn) return false
      const { data } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', user.id)
        .eq('following_id', post.user_id)
        .maybeSingle()
      return !!data
    },
    enabled: !!user && !isOwn,
  })

  const toggleFollow = useMutation({
    mutationFn: async () => {
      if (isFollowing) {
        await supabase.from('follows').delete().eq('follower_id', user!.id).eq('following_id', post.user_id)
      } else {
        await supabase.from('follows').insert({ follower_id: user!.id, following_id: post.user_id })
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['follow', post.user_id, user?.id] })
      const prev = queryClient.getQueryData(['follow', post.user_id, user?.id])
      queryClient.setQueryData(['follow', post.user_id, user?.id], !isFollowing)
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) queryClient.setQueryData(['follow', post.user_id, user?.id], ctx.prev)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-social'] })
    },
  })

  // Auto-play video when in viewport
  useEffect(() => {
    if (!videoRef.current) return
    const video = videoRef.current
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          video.play().catch(() => {})
        } else {
          video.pause()
        }
      },
      { threshold: [0, 0.6, 1] }
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [currentPage, post.pages])

  // Toggle like (optimistic)
  const toggleLike = useMutation({
    mutationFn: async () => {
      if (post.likedByMe) {
        await supabase.from('post_likes').delete().eq('user_id', user!.id).eq('post_id', post.id)
      } else {
        await supabase.from('post_likes').insert({ user_id: user!.id, post_id: post.id })
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['feed-posts'] })
      const prev = queryClient.getQueryData(['feed-posts'])
      queryClient.setQueryData(['feed-posts'], (old: any) =>
        (old || []).map((p: any) =>
          p.id === post.id
            ? { ...p, likedByMe: !p.likedByMe, likesCount: p.likesCount + (p.likedByMe ? -1 : 1) }
            : p
        )
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['feed-posts'], ctx.prev)
    },
  })

  // Add comment (optimistic)
  const addComment = useMutation({
    mutationFn: async (text: string) => {
      const { data, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: post.id,
          user_id: user!.id,
          text,
          parent_id: replyTo?.id || null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async (text) => {
      await queryClient.cancelQueries({ queryKey: ['feed-posts'] })
      const prev = queryClient.getQueryData(['feed-posts'])
      const tempId = `temp-${Date.now()}`
      queryClient.setQueryData(['feed-posts'], (old: any) =>
        (old || []).map((p: any) =>
          p.id === post.id
            ? {
              ...p,
              comments: [...p.comments, {
                id: tempId,
                post_id: post.id,
                user_id: user!.id,
                text,
                parent_id: replyTo?.id || null,
                created_at: new Date().toISOString(),
                author: { name: 'Você', avatar_url: null },
                likesCount: 0,
                likedByMe: false,
              }],
              commentsCount: p.commentsCount + 1,
            }
            : p
        )
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['feed-posts'], ctx.prev)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-posts'] })
    },
  })

  // Toggle comment like (optimistic)
  const toggleCommentLike = useMutation({
    mutationFn: async ({ commentId, liked }: { commentId: string; liked: boolean }) => {
      if (liked) {
        await supabase.from('comment_likes').delete().eq('user_id', user!.id).eq('comment_id', commentId)
      } else {
        await supabase.from('comment_likes').insert({ user_id: user!.id, comment_id: commentId })
      }
    },
    onMutate: async ({ commentId }) => {
      await queryClient.cancelQueries({ queryKey: ['feed-posts'] })
      const prev = queryClient.getQueryData(['feed-posts'])
      queryClient.setQueryData(['feed-posts'], (old: any) =>
        (old || []).map((p: any) =>
          p.id === post.id
            ? {
              ...p,
              comments: p.comments.map((c: any) =>
                c.id === commentId
                  ? { ...c, likedByMe: !c.likedByMe, likesCount: c.likesCount + (c.likedByMe ? -1 : 1) }
                  : c
              ),
            }
            : p
        )
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['feed-posts'], ctx.prev)
    },
  })

  // Delete post
  const deletePost = useMutation({
    mutationFn: async () => {
      await supabase.from('posts').delete().eq('id', post.id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed-posts'] }),
  })

  // Delete comment
  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      await supabase.from('post_comments').delete().eq('id', commentId)
    },
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: ['feed-posts'] })
      const prev = queryClient.getQueryData(['feed-posts'])
      queryClient.setQueryData(['feed-posts'], (old: any) =>
        (old || []).map((p: any) =>
          p.id === post.id
            ? { ...p, comments: p.comments.filter((c: any) => c.id !== commentId), commentsCount: p.commentsCount - 1 }
            : p
        )
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['feed-posts'], ctx.prev)
    },
  })

  function handleSubmitComment() {
    const text = newComment.trim()
    if (!text) return
    addComment.mutate(text)
    setNewComment('')
    setReplyTo(null)
  }

  function formatDate(date: string) {
    const d = new Date(date)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
    if (diff < 60) return 'agora'
    if (diff < 3600) return `${Math.floor(diff / 60)} min`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  // Group comments by parent
  const topComments = post.comments.filter((c: any) => !c.parent_id)
  const repliesByParent = post.comments.reduce((acc: any, c: any) => {
    if (c.parent_id) {
      if (!acc[c.parent_id]) acc[c.parent_id] = []
      acc[c.parent_id].push(c)
    }
    return acc
  }, {})

  const currentPageData = post.pages[currentPage]

  return (
    <div className="bg-bg-card border border-navy-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button
          onClick={() => navigate(`/perfil/${post.user_id}`)}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left flex-1 min-w-0"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden bg-navy-900 flex items-center justify-center flex-shrink-0">
            {post.author.avatar_url ? (
              <img src={post.author.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-text-muted" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">{post.author.name}</p>
            {post.author.profession && (
              <p className="text-xs text-text-muted truncate">{post.author.profession}</p>
            )}
          </div>
        </button>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!isOwn && user && (
            <>
              <button
                onClick={() => navigate(`/perfil/${post.user_id}`)}
                className="p-2 text-text-muted hover:text-text-primary bg-navy-800 hover:bg-navy-700 rounded-lg transition-colors"
                title="Ver perfil"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => toggleFollow.mutate()}
                className={`p-2 rounded-lg transition-colors ${
                  isFollowing
                    ? 'bg-green-900/30 text-green-400 hover:bg-red-900/30 hover:text-red-veon'
                    : 'bg-red-veon hover:bg-red-veon-dark text-white'
                }`}
                title={isFollowing ? 'Deixar de seguir' : 'Seguir'}
              >
                {isFollowing ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              </button>
            </>
          )}
          {isOwn && (
            <div className="relative">
              <button onClick={() => setShowMenu(!showMenu)} className="p-2 text-text-muted hover:text-text-primary">
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-9 bg-bg-input border border-navy-700 rounded-lg p-1 z-10 min-w-[120px]">
                  <button
                    onClick={() => { if (confirm('Excluir este post?')) deletePost.mutate() }}
                    className="w-full flex items-center gap-2 text-xs text-red-veon hover:bg-red-900/20 px-3 py-2 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir post
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Carousel */}
      <div className="relative aspect-[4/5] bg-navy-900">
        {/* Uploading overlay */}
        {post._uploading && (
          <div className="absolute inset-0 bg-black/60 z-20 flex flex-col items-center justify-center text-white">
            <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm">Publicando...</p>
          </div>
        )}
        {currentPageData && (
          <>
            {currentPageData.type === 'image' && currentPageData.image_url && (
              <img
                src={currentPageData.image_url}
                alt=""
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            )}
            {currentPageData.type === 'video' && currentPageData.image_url && (
              <FeedVideo
                ref={videoRef}
                key={currentPageData.id}
                src={currentPageData.image_url}
              />
            )}
            {currentPageData.type === 'audio' && currentPageData.image_url && (
              <AudioPlayer src={currentPageData.image_url} duration={currentPageData.duration_seconds} />
            )}
          </>
        )}

        {/* Carousel arrows */}
        {post.pages.length > 1 && (
          <>
            {currentPage > 0 && (
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            {currentPage < post.pages.length - 1 && (
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {/* Page indicator */}
            <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full">
              {currentPage + 1}/{post.pages.length}
            </div>
            {/* Dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {post.pages.map((_: any, i: number) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === currentPage ? 'bg-white' : 'bg-white/40'}`} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-5">
        <button
          onClick={() => toggleLike.mutate()}
          className="flex items-center gap-1.5 text-text-secondary hover:scale-110 transition-transform"
        >
          <Heart className={`w-6 h-6 ${post.likedByMe ? 'fill-red-veon text-red-veon' : ''}`} />
          <span className="text-sm font-semibold text-text-primary">{post.likesCount}</span>
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="text-sm font-semibold text-text-primary">{post.commentsCount}</span>
        </button>
        <button
          onClick={() => setShowShare(true)}
          className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary hover:scale-110 transition-transform"
          title="Compartilhar"
        >
          <Send className="w-[22px] h-[22px] -translate-y-px" strokeWidth={2} />
          <span className="text-sm font-semibold text-text-primary">{post.sharesCount || 0}</span>
        </button>
      </div>

      {showShare && <ShareMenu post={post} onClose={() => setShowShare(false)} />}

      {/* Caption */}
      {post.caption && (
        <p className="px-4 pt-1 text-sm text-text-primary">
          <button
            onClick={() => navigate(`/perfil/${post.user_id}`)}
            className="font-semibold hover:text-red-veon transition-colors"
          >
            {post.author.name}
          </button>{' '}
          <span className="text-text-secondary whitespace-pre-line">{post.caption}</span>
        </p>
      )}

      {/* Comments toggle */}
      {post.commentsCount > 0 && !showComments && (
        <button
          onClick={() => setShowComments(true)}
          className="px-4 pt-1 text-xs text-text-muted hover:text-text-secondary block"
        >
          Ver {post.commentsCount === 1 ? 'comentário' : `os ${post.commentsCount} comentários`}
        </button>
      )}

      {/* Comments */}
      {showComments && (
        <div className="px-4 pt-3 pb-2 border-t border-navy-800 mt-3 space-y-3">
          {topComments.map((c: any) => (
            <div key={c.id} className="space-y-2">
              <CommentItem
                comment={c}
                isOwn={c.user_id === user?.id}
                onLike={() => toggleCommentLike.mutate({ commentId: c.id, liked: c.likedByMe })}
                onReply={() => setReplyTo({ id: c.id, name: c.author.name })}
                onDelete={() => deleteComment.mutate(c.id)}
                formatDate={formatDate}
              />
              {/* Replies */}
              {repliesByParent[c.id]?.map((reply: any) => (
                <div key={reply.id} className="ml-10">
                  <CommentItem
                    comment={reply}
                    isOwn={reply.user_id === user?.id}
                    onLike={() => toggleCommentLike.mutate({ commentId: reply.id, liked: reply.likedByMe })}
                    onReply={() => setReplyTo({ id: c.id, name: reply.author.name })}
                    onDelete={() => deleteComment.mutate(reply.id)}
                    formatDate={formatDate}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Comment input */}
      <div className="border-t border-navy-800 p-3 flex items-center gap-2">
        {replyTo && (
          <div className="absolute -translate-y-9 bg-bg-input text-xs text-text-muted px-3 py-1 rounded-full flex items-center gap-2">
            Respondendo a <span className="text-text-primary">@{replyTo.name}</span>
            <button onClick={() => setReplyTo(null)} className="text-red-veon">×</button>
          </div>
        )}
        <input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitComment() }}
          className="flex-1 bg-bg-input border border-navy-700 rounded-full px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-red-veon"
          placeholder={replyTo ? `Responder a @${replyTo.name}...` : 'Adicione um comentário...'}
        />
        <button
          onClick={handleSubmitComment}
          disabled={!newComment.trim()}
          className="text-red-veon hover:text-red-veon-dark disabled:opacity-30"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

const FeedVideo = forwardRef<HTMLVideoElement, { src: string }>(({ src }, ref) => {
  const localRef = useRef<HTMLVideoElement>(null)
  // Sync external ref
  useEffect(() => {
    if (!ref) return
    if (typeof ref === 'function') ref(localRef.current)
    else ref.current = localRef.current
  }, [ref])

  const [muted, setMuted] = useState(true)
  const [progress, setProgress] = useState(0)
  const [holding, setHolding] = useState(false)
  const holdTimerRef = useRef<number | null>(null)

  function handlePointerDown(e: React.PointerEvent) {
    if (!localRef.current) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const xRatio = (e.clientX - rect.left) / rect.width
    const yRatio = (e.clientY - rect.top) / rect.height
    // Right-top quadrant: x > 0.5, y < 0.5
    if (xRatio > 0.5 && yRatio < 0.5) {
      // Start hold timer (300ms to confirm hold)
      holdTimerRef.current = window.setTimeout(() => {
        if (localRef.current) {
          localRef.current.playbackRate = 1.25
          setHolding(true)
        }
      }, 300)
    }
  }

  function handlePointerUp() {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    if (localRef.current) {
      localRef.current.playbackRate = 1
    }
    setHolding(false)
  }

  function handleVideoClick() {
    if (!localRef.current || holding) return
    if (localRef.current.paused) localRef.current.play()
    else localRef.current.pause()
  }

  return (
    <div
      className="relative w-full h-full"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <video
        ref={localRef}
        src={src}
        className="w-full h-full object-cover"
        playsInline
        muted={muted}
        loop
        preload="metadata"
        onClick={handleVideoClick}
        onTimeUpdate={(e) => {
          const v = e.currentTarget
          if (v.duration > 0) setProgress((v.currentTime / v.duration) * 100)
        }}
      />

      {/* Mute toggle (Instagram style: bottom-right) */}
      <button
        onClick={(e) => { e.stopPropagation(); setMuted(!muted) }}
        className="absolute bottom-3 right-3 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full p-2 transition-colors z-10"
      >
        {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
      </button>

      {/* Speed indicator */}
      {holding && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full pointer-events-none z-10">
          1.25×
        </div>
      )}

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
        <div className="h-full bg-white transition-[width] duration-100" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
})

function AudioPlayer({ src, duration }: { src: string; duration?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(duration || 0)

  function toggle() {
    if (!audioRef.current) return
    if (playing) audioRef.current.pause()
    else audioRef.current.play()
    setPlaying(!playing)
  }

  function format(s: number) {
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-green-900/50 to-navy-900 flex flex-col items-center justify-center p-8">
      <button
        onClick={toggle}
        className="w-24 h-24 rounded-full bg-green-600 hover:bg-green-700 flex items-center justify-center mb-6 transition-colors shadow-xl"
      >
        {playing ? <Pause className="w-12 h-12 text-white" /> : <Play className="w-12 h-12 text-white ml-1" />}
      </button>
      <Mic className="w-6 h-6 text-text-muted mb-2" />
      <p className="text-text-primary font-mono text-lg">
        {format(currentTime)} / {format(audioDuration)}
      </p>
      {audioDuration > 0 && (
        <div className="w-full max-w-xs h-1.5 bg-navy-800 rounded-full mt-3 overflow-hidden">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${(currentTime / audioDuration) * 100}%` }} />
        </div>
      )}
      <audio
        ref={audioRef}
        src={src}
        onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={() => { setPlaying(false); setCurrentTime(0) }}
      />
    </div>
  )
}

function CommentItem({ comment, isOwn, onLike, onReply, onDelete, formatDate }: any) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-7 h-7 rounded-full overflow-hidden bg-navy-900 flex items-center justify-center flex-shrink-0">
        {comment.author.avatar_url ? (
          <img src={comment.author.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <User className="w-3.5 h-3.5 text-text-muted" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-semibold text-text-primary">{comment.author.name}</span>{' '}
          <span className="text-text-secondary">{comment.text}</span>
        </p>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-text-muted">
          <span>{formatDate(comment.created_at)}</span>
          {comment.likesCount > 0 && <span>{comment.likesCount} {comment.likesCount === 1 ? 'curtida' : 'curtidas'}</span>}
          <button onClick={onReply} className="hover:text-text-primary font-semibold">Responder</button>
          {isOwn && (
            <button onClick={onDelete} className="hover:text-red-veon">Excluir</button>
          )}
        </div>
      </div>
      <button onClick={onLike} className="flex-shrink-0 mt-1">
        <Heart className={`w-3.5 h-3.5 ${comment.likedByMe ? 'fill-red-veon text-red-veon' : 'text-text-muted'}`} />
      </button>
    </div>
  )
}
