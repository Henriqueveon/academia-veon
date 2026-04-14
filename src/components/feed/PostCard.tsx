import { useState, useRef, useEffect, forwardRef, memo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Heart, MessageCircle, ChevronLeft, ChevronRight, User, Send, Trash2, MoreHorizontal, Play, Pause, Mic, Eye, UserPlus, UserCheck, Volume2, VolumeX } from 'lucide-react'
import { ShareMenu } from './ShareMenu'
import { UploadingMedia } from './UploadingMedia'
import { MediaFallback } from './MediaFallback'
import { usePostReady } from '../../hooks/usePostReady'

interface Props {
  post: any
  priority?: boolean   // first visible post → fetchpriority="high" + isInitial=true
  isInitial?: boolean  // counted toward feedReadyStore.initialReadyCount (cold-start unlock)
}

function PostCardImpl({ post, priority = false, isInitial = false }: Props) {
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

  // Gating: skeleton until first media loads (or 4s failsafe).
  // Audio/in-flight uploading posts skip the gate (audio is metadata-only,
  // uploading already shows its own UploadingMedia overlay).
  const firstPage = post.pages?.[0]
  const skipGate = post.status === 'uploading' || post.status === 'failed' || firstPage?.type === 'audio'
  const { ready, errored, onMediaLoad, onMediaError } = usePostReady(post.id, { isInitial })
  const showSkeleton = !skipGate && !ready

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

  // Feed query key (must match FeedPage)
  const feedKey = ['feed-posts', user?.id]

  // Helper: update a single post in the infinite query cache
  function updatePostInCache(updater: (p: any) => any) {
    queryClient.setQueryData<any>(feedKey, (old: any) => {
      if (!old) return old
      // Handles both InfiniteQuery shape and plain array (defensive)
      if (old.pages) {
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            posts: page.posts.map((p: any) => (p.id === post.id ? updater(p) : p)),
          })),
        }
      }
      return (old || []).map((p: any) => (p.id === post.id ? updater(p) : p))
    })
  }

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
      await queryClient.cancelQueries({ queryKey: feedKey })
      const prev = queryClient.getQueryData(feedKey)
      updatePostInCache((p: any) => ({
        ...p,
        likedByMe: !p.likedByMe,
        likesCount: p.likesCount + (p.likedByMe ? -1 : 1),
      }))
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(feedKey, ctx.prev)
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
      await queryClient.cancelQueries({ queryKey: feedKey })
      const prev = queryClient.getQueryData(feedKey)
      const tempId = `temp-${Date.now()}`
      const currentProfile = queryClient.getQueryData<any>(['profile', user?.id])
      updatePostInCache((p: any) => ({
        ...p,
        comments: [...(p.comments || []), {
          id: tempId,
          post_id: post.id,
          user_id: user!.id,
          text,
          parent_id: replyTo?.id || null,
          created_at: new Date().toISOString(),
          author: {
            name: currentProfile?.name || 'Você',
            avatar_url: currentProfile?.avatar_url || null,
          },
          likesCount: 0,
          likedByMe: false,
        }],
        commentsCount: (p.commentsCount || 0) + 1,
      }))
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(feedKey, ctx.prev)
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
      await queryClient.cancelQueries({ queryKey: feedKey })
      const prev = queryClient.getQueryData(feedKey)
      updatePostInCache((p: any) => ({
        ...p,
        comments: (p.comments || []).map((c: any) =>
          c.id === commentId
            ? { ...c, likedByMe: !c.likedByMe, likesCount: c.likesCount + (c.likedByMe ? -1 : 1) }
            : c
        ),
      }))
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(feedKey, ctx.prev)
    },
  })

  // Delete post (optimistic)
  const deletePost = useMutation({
    mutationFn: async () => {
      await supabase.from('posts').delete().eq('id', post.id)
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: feedKey })
      const prev = queryClient.getQueryData(feedKey)
      queryClient.setQueryData<any>(feedKey, (old: any) => {
        if (!old) return old
        if (old.pages) {
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              posts: page.posts.filter((p: any) => p.id !== post.id),
            })),
          }
        }
        return (old || []).filter((p: any) => p.id !== post.id)
      })
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(feedKey, ctx.prev)
    },
  })

  // Delete comment (optimistic)
  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      await supabase.from('post_comments').delete().eq('id', commentId)
    },
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: feedKey })
      const prev = queryClient.getQueryData(feedKey)
      updatePostInCache((p: any) => ({
        ...p,
        comments: (p.comments || []).filter((c: any) => c.id !== commentId),
        commentsCount: Math.max(0, (p.commentsCount || 0) - 1),
      }))
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(feedKey, ctx.prev)
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
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000)
    if (diffSec < 60) return 'agora'
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`
    const sameYear = d.getFullYear() === now.getFullYear()
    return d.toLocaleDateString('pt-BR', sameYear
      ? { day: '2-digit', month: 'short' }
      : { day: '2-digit', month: 'short', year: 'numeric' }
    )
  }

  function formatDateFull(date: string) {
    const d = new Date(date)
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }) + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
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
  const isAudioOnly = post.pages.length > 0 && post.pages.every((p: any) => p.type === 'audio')

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
            <div className="flex items-center gap-1.5 text-xs text-text-muted truncate">
              {post.author.profession && (
                <>
                  <span className="truncate">{post.author.profession}</span>
                  <span>·</span>
                </>
              )}
              <time
                dateTime={post.created_at}
                title={formatDateFull(post.created_at)}
                className="flex-shrink-0"
              >
                {formatDate(post.created_at)}
              </time>
            </div>
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
      <div className={`relative bg-navy-900 ${isAudioOnly ? 'px-4 py-3' : 'aspect-[4/5]'}`}>
        {/* Uploading / failed skeleton overlay (visible only to the author via feed filter) */}
        {(post.status === 'uploading' || post.status === 'failed') && (
          <UploadingMedia post={{ id: post.id, status: post.status, failed_reason: post.failed_reason }} />
        )}
        {post.status !== 'uploading' && post.status !== 'failed' && currentPageData && (
          <>
            {errored ? (
              <MediaFallback variant={currentPageData.type} />
            ) : (
              <div
                className={`absolute inset-0 transition-opacity duration-200 ${ready || skipGate ? 'opacity-100' : 'opacity-0'}`}
              >
                {currentPageData.type === 'image' && currentPageData.image_url && (
                  <img
                    src={currentPageData.image_url}
                    alt=""
                    width={800}
                    height={1000}
                    loading={priority ? 'eager' : 'lazy'}
                    decoding="async"
                    fetchPriority={priority ? 'high' : 'low'}
                    className="w-full h-full object-cover"
                    onLoad={onMediaLoad}
                    onError={onMediaError}
                  />
                )}
                {currentPageData.type === 'video' && currentPageData.image_url && (
                  <FeedVideo
                    ref={videoRef}
                    key={currentPageData.id}
                    src={currentPageData.image_url}
                    poster={currentPageData.thumbnail_url || undefined}
                    onCanPlay={onMediaLoad}
                    onError={onMediaError}
                  />
                )}
                {currentPageData.type === 'audio' && currentPageData.image_url && (
                  <AudioPlayer src={currentPageData.image_url} duration={currentPageData.duration_seconds} />
                )}
              </div>
            )}
            {/* Skeleton overlay until first media loads (fades out on ready) */}
            {showSkeleton && !errored && (
              <div className="absolute inset-0 bg-navy-800 animate-pulse z-5" />
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

      {/* Actions — hidden while the post is not public */}
      {post.status !== 'uploading' && post.status !== 'failed' && (
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
      )}

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

export const PostCard = memo(PostCardImpl, (prev, next) => {
  return (
    prev.priority === next.priority &&
    prev.isInitial === next.isInitial &&
    prev.post.id === next.post.id &&
    prev.post.status === next.post.status &&
    prev.post.failed_reason === next.post.failed_reason &&
    prev.post.likesCount === next.post.likesCount &&
    prev.post.commentsCount === next.post.commentsCount &&
    prev.post.sharesCount === next.post.sharesCount &&
    prev.post.likedByMe === next.post.likedByMe &&
    prev.post.caption === next.post.caption &&
    prev.post.pages === next.post.pages &&
    prev.post.comments === next.post.comments
  )
})

const FeedVideo = forwardRef<HTMLVideoElement, { src: string; poster?: string; onCanPlay?: () => void; onError?: () => void }>(({ src, poster, onCanPlay, onError }, ref) => {
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

  // Eagerly buffer when card enters viewport (with preload="metadata", bytes are skipped on load).
  useEffect(() => {
    if (!localRef.current) return
    const v = localRef.current
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.3) v.load()
      },
      { threshold: [0, 0.3] },
    )
    observer.observe(v)
    return () => observer.disconnect()
  }, [src])

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
        poster={poster}
        className="w-full h-full object-cover bg-navy-900"
        playsInline
        muted={muted}
        loop
        preload="metadata"
        onClick={handleVideoClick}
        onCanPlay={onCanPlay}
        onLoadedMetadata={onCanPlay}
        onError={onError}
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

const PLAYBACK_RATES = [1, 1.25, 1.5]

function AudioPlayer({ src, duration }: { src: string; duration?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState<number>(
    duration && isFinite(duration) && duration > 0 ? duration : 0
  )
  const [rateIndex, setRateIndex] = useState(0)
  const playbackRate = PLAYBACK_RATES[rateIndex]

  function cyclePlaybackRate() {
    const next = (rateIndex + 1) % PLAYBACK_RATES.length
    setRateIndex(next)
    if (audioRef.current) audioRef.current.playbackRate = PLAYBACK_RATES[next]
  }

  // Workaround: WebM duration trick — if duration is Infinity, seek to large value to force browser to compute it
  function handleLoadedMetadata(e: React.SyntheticEvent<HTMLAudioElement>) {
    const audio = e.currentTarget
    if (!isFinite(audio.duration)) {
      audio.currentTime = 1e10
      const onSeek = () => {
        audio.currentTime = 0
        if (isFinite(audio.duration) && audio.duration > 0) {
          setAudioDuration(audio.duration)
        }
        audio.removeEventListener('seeked', onSeek)
      }
      audio.addEventListener('seeked', onSeek)
    } else if (audio.duration > 0) {
      setAudioDuration(audio.duration)
    }
  }

  async function toggle() {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      try {
        await audioRef.current.play()
        setPlaying(true)
      } catch (err) {
        console.warn('Audio play failed:', err)
      }
    }
  }

  function format(s: number) {
    if (!isFinite(s) || s < 0) return '0:00'
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    if (!audioRef.current || !progressRef.current || audioDuration === 0) return
    const rect = progressRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audioRef.current.currentTime = audioDuration * ratio
    setCurrentTime(audioDuration * ratio)
  }

  // Static waveform pattern (pseudo-random heights for visual effect)
  const waveBars = Array.from({ length: 32 }, (_, i) => {
    const seed = (i * 7919) % 100
    return 30 + (seed % 70)
  })

  const progressPct = audioDuration > 0 ? Math.min(100, (currentTime / audioDuration) * 100) : 0

  return (
    <div className="w-full bg-gradient-to-r from-navy-900 to-bg-card border border-navy-700 rounded-2xl p-3 flex items-center gap-3">
      {/* Play button */}
      <button
        onClick={toggle}
        className="w-11 h-11 rounded-full bg-green-600 hover:bg-green-700 flex items-center justify-center transition-colors flex-shrink-0 shadow-md"
      >
        {playing ? (
          <Pause className="w-5 h-5 text-white" />
        ) : (
          <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
        )}
      </button>

      {/* Waveform + time */}
      <div className="flex-1 min-w-0">
        <div
          ref={progressRef}
          onClick={handleSeek}
          className="flex items-center gap-[2px] h-8 cursor-pointer"
        >
          {waveBars.map((height, i) => {
            const barProgress = (i / waveBars.length) * 100
            const filled = barProgress <= progressPct
            return (
              <div
                key={i}
                className={`flex-1 rounded-full transition-colors ${
                  filled ? 'bg-green-400' : 'bg-text-muted/40'
                }`}
                style={{ height: `${height}%` }}
              />
            )
          })}
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-text-muted font-mono">{format(currentTime)}</span>
          <div className="flex items-center gap-1">
            <Mic className="w-3 h-3 text-green-400" />
            <span className="text-xs text-text-muted font-mono">{format(audioDuration)}</span>
          </div>
        </div>
      </div>

      {/* Playback speed (only visible when playing) */}
      {playing && (
        <button
          onClick={cyclePlaybackRate}
          className="bg-green-600 hover:bg-green-700 text-white text-[11px] font-bold rounded-full w-10 h-7 flex items-center justify-center flex-shrink-0 transition-colors"
          title="Velocidade"
        >
          {playbackRate}×
        </button>
      )}

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration
          if (isFinite(d) && d > 0) setAudioDuration(d)
        }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime
          if (isFinite(t)) setCurrentTime(t)
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
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
          <time
            dateTime={comment.created_at}
            title={new Date(comment.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) + ' às ' + new Date(comment.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          >
            {formatDate(comment.created_at)}
          </time>
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
