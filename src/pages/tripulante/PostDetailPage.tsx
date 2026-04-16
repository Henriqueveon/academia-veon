import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { PostCard } from '../../components/feed/PostCard'
import { Spinner } from '../../components/ui/Spinner'

export function PostDetailPage() {
  const { postId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [post, setPost] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!postId) return
    let cancelled = false

    async function load() {
      const { data } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .maybeSingle()

      if (cancelled) return

      if (!data || data.status === 'failed') {
        setNotFound(true)
        setLoading(false)
        return
      }

      const [pagesRes, profileRes, likesRes, commentsRes, sharesRes, viewsRes] = await Promise.all([
        supabase.from('post_pages').select('*').eq('post_id', postId).order('sort_order'),
        supabase.from('profiles').select('id, name, avatar_url, profession').eq('id', data.user_id).single(),
        supabase.from('post_likes').select('*').eq('post_id', postId),
        supabase.from('post_comments').select('*').eq('post_id', postId).order('created_at'),
        supabase.from('post_shares').select('post_id').eq('post_id', postId),
        supabase.from('post_views').select('post_id').eq('post_id', postId),
      ])

      if (cancelled) return

      const commentIds = (commentsRes.data || []).map((c: any) => c.id)
      let commentLikesData: any[] = []
      if (commentIds.length > 0) {
        const { data: cl } = await supabase.from('comment_likes').select('*').in('comment_id', commentIds)
        commentLikesData = cl || []
      }

      const commentUserIds = [...new Set((commentsRes.data || []).map((c: any) => c.user_id))]
      const { data: commentProfiles } = commentUserIds.length > 0
        ? await supabase.from('profiles').select('id, name, avatar_url').in('id', commentUserIds)
        : { data: [] as any[] }
      const profileMap = new Map((commentProfiles || []).map((p: any) => [p.id, p]))

      // Show the post immediately with the snapshot count
      setPost({
        ...data,
        pages: pagesRes.data || [],
        author: profileRes.data || { name: '—', avatar_url: null },
        likes: likesRes.data || [],
        likedByMe: (likesRes.data || []).some((l: any) => l.user_id === user?.id),
        likesCount: (likesRes.data || []).length,
        comments: (commentsRes.data || []).map((c: any) => ({
          ...c,
          author: profileMap.get(c.user_id) || { name: '—', avatar_url: null },
          likesCount: commentLikesData.filter((cl: any) => cl.comment_id === c.id).length,
          likedByMe: commentLikesData.some((cl: any) => cl.comment_id === c.id && cl.user_id === user?.id),
        })),
        commentsCount: (commentsRes.data || []).length,
        sharesCount: (sharesRes.data || []).length,
        viewsCount: (viewsRes.data || []).length,
      })
      setLoading(false)

      // Register view then refresh the count so the owner sees the updated number
      await supabase.rpc('register_post_view', { p_post_id: postId })
      if (cancelled) return
      const { count } = await supabase
        .from('post_views')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId)
      if (!cancelled && count !== null) {
        setPost((prev: any) => ({ ...prev, viewsCount: count }))
      }
    }

    load()
    return () => { cancelled = true }
  }, [postId, user?.id])

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 px-4 py-3 sticky top-0 bg-bg-primary/95 backdrop-blur-md border-b border-navy-800 z-10">
        <button
          onClick={() => navigate(-1)}
          className="text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold text-text-primary">Post</h1>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Spinner size="md" />
        </div>
      )}

      {notFound && (
        <div className="text-center py-12 text-text-muted">
          <p>Post não encontrado.</p>
        </div>
      )}

      {post && (
        <div className="py-4">
          <PostCard post={post} detailMode />
        </div>
      )}
    </div>
  )
}
