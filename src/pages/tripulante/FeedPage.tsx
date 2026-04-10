import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Plus } from 'lucide-react'
import { CreatePostWizard } from '../../components/feed/CreatePostWizard'
import { PostCard } from '../../components/feed/PostCard'

export function FeedPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['feed-posts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
      if (!data) return []

      const postIds = data.map((p: any) => p.id)
      const userIds = [...new Set(data.map((p: any) => p.user_id))]

      const [pages, likes, comments, commentLikes, profiles] = await Promise.all([
        supabase.from('post_pages').select('*').in('post_id', postIds).order('sort_order'),
        supabase.from('post_likes').select('*').in('post_id', postIds),
        supabase.from('post_comments').select('*').in('post_id', postIds).order('created_at'),
        supabase.from('comment_likes').select('*'),
        supabase.from('profiles').select('id, name, avatar_url, profession').in('id', userIds),
      ])

      // Get comment user profiles
      const commentUserIds = [...new Set((comments.data || []).map((c: any) => c.user_id))]
      const { data: commentProfiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', commentUserIds.length > 0 ? commentUserIds : ['none'])

      const profileMap = new Map([...(profiles.data || []), ...(commentProfiles || [])].map((p: any) => [p.id, p]))

      return data.map((post: any) => ({
        ...post,
        author: profileMap.get(post.user_id) || { name: '—', avatar_url: null },
        pages: (pages.data || []).filter((p: any) => p.post_id === post.id),
        likes: (likes.data || []).filter((l: any) => l.post_id === post.id),
        comments: (comments.data || [])
          .filter((c: any) => c.post_id === post.id)
          .map((c: any) => ({
            ...c,
            author: profileMap.get(c.user_id) || { name: '—', avatar_url: null },
            likesCount: (commentLikes.data || []).filter((cl: any) => cl.comment_id === c.id).length,
            likedByMe: (commentLikes.data || []).some((cl: any) => cl.comment_id === c.id && cl.user_id === user?.id),
          })),
        likedByMe: (likes.data || []).some((l: any) => l.post_id === post.id && l.user_id === user?.id),
        likesCount: (likes.data || []).filter((l: any) => l.post_id === post.id).length,
        commentsCount: (comments.data || []).filter((c: any) => c.post_id === post.id).length,
      }))
    },
    enabled: !!user,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-red-veon border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Comunidade</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-red-veon hover:bg-red-veon-dark text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo Post
        </button>
      </div>

      {showCreate && (
        <CreatePostWizard
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            queryClient.invalidateQueries({ queryKey: ['feed-posts'] })
          }}
        />
      )}

      {posts.length === 0 && !showCreate && (
        <div className="text-center py-20 text-text-muted">
          <p className="text-lg">Nenhum post ainda.</p>
          <p className="text-sm mt-1">Seja o primeiro a postar na comunidade!</p>
        </div>
      )}

      <div className="space-y-6">
        {posts.map((post: any) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  )
}
