import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Heart, MessageCircle, ChevronLeft, ChevronRight, User, Send, Trash2, MoreHorizontal, Play, Pause, Mic } from 'lucide-react'

interface Props {
  post: any
}

export function PostCard({ post }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [currentPage, setCurrentPage] = useState(0)
  const [showComments, setShowComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null)
  const [showMenu, setShowMenu] = useState(false)

  const isOwn = post.user_id === user?.id

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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-navy-900 flex items-center justify-center">
            {post.author.avatar_url ? (
              <img src={post.author.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-text-muted" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">{post.author.name}</p>
            {post.author.profession && (
              <p className="text-xs text-text-muted">{post.author.profession}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">{formatDate(post.created_at)}</span>
          {isOwn && (
            <div className="relative">
              <button onClick={() => setShowMenu(!showMenu)} className="p-1 text-text-muted hover:text-text-primary">
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-7 bg-bg-input border border-navy-700 rounded-lg p-1 z-10 min-w-[120px]">
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
              <img src={currentPageData.image_url} alt="" className="w-full h-full object-cover" />
            )}
            {currentPageData.type === 'video' && currentPageData.image_url && (
              <video
                key={currentPageData.id}
                src={currentPageData.image_url}
                className="w-full h-full object-cover"
                controls
                playsInline
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
      <div className="px-4 pt-3 pb-2 flex items-center gap-4">
        <button
          onClick={() => toggleLike.mutate()}
          className="flex items-center gap-1.5 text-text-secondary hover:scale-110 transition-transform"
        >
          <Heart className={`w-6 h-6 ${post.likedByMe ? 'fill-red-veon text-red-veon' : ''}`} />
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      </div>

      {/* Likes count */}
      {post.likesCount > 0 && (
        <p className="px-4 text-sm font-semibold text-text-primary">
          {post.likesCount} {post.likesCount === 1 ? 'curtida' : 'curtidas'}
        </p>
      )}

      {/* Caption */}
      {post.caption && (
        <p className="px-4 pt-1 text-sm text-text-primary">
          <span className="font-semibold">{post.author.name}</span>{' '}
          <span className="text-text-secondary whitespace-pre-line">{post.caption}</span>
        </p>
      )}

      {/* Comments toggle */}
      {post.commentsCount > 0 && !showComments && (
        <button
          onClick={() => setShowComments(true)}
          className="px-4 pt-1 text-xs text-text-muted hover:text-text-secondary"
        >
          Ver {post.commentsCount} {post.commentsCount === 1 ? 'comentário' : 'comentários'}
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
