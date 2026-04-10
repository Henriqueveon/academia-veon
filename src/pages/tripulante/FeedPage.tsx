import { useState, useRef, useEffect } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Plus, RefreshCw } from 'lucide-react'
import { CreatePostWizard } from '../../components/feed/CreatePostWizard'
import { PostCard } from '../../components/feed/PostCard'
import { NotificationsBell } from '../../components/feed/NotificationsBell'
import { saveCache, loadCache } from '../../lib/feedCache'

const PAGE_SIZE = 5
const CACHE_KEY = 'feed-first-page'

interface FeedPage {
  posts: any[]
  nextCursor: string | null
}

async function fetchFeedPage(cursor: string | null, userId: string | null): Promise<FeedPage> {
  let query = supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)

  if (cursor) query = query.lt('created_at', cursor)

  const { data: posts } = await query
  if (!posts || posts.length === 0) return { posts: [], nextCursor: null }

  const postIds = posts.map((p: any) => p.id)
  const userIds = [...new Set(posts.map((p: any) => p.user_id))]

  const [pages, likes, comments, shares, profiles] = await Promise.all([
    supabase.from('post_pages').select('*').in('post_id', postIds).order('sort_order'),
    supabase.from('post_likes').select('*').in('post_id', postIds),
    supabase.from('post_comments').select('*').in('post_id', postIds).order('created_at'),
    supabase.from('post_shares').select('post_id').in('post_id', postIds),
    supabase.from('profiles').select('id, name, avatar_url, profession').in('id', userIds),
  ])

  // Fetch comment_likes only for the comments we have
  const commentIds = (comments.data || []).map((c: any) => c.id)
  let commentLikesData: any[] = []
  if (commentIds.length > 0) {
    const { data } = await supabase.from('comment_likes').select('*').in('comment_id', commentIds)
    commentLikesData = data || []
  }

  const commentUserIds = [...new Set((comments.data || []).map((c: any) => c.user_id))]
  const { data: commentProfiles } = commentUserIds.length > 0
    ? await supabase.from('profiles').select('id, name, avatar_url').in('id', commentUserIds)
    : { data: [] }

  const profileMap = new Map([...(profiles.data || []), ...(commentProfiles || [])].map((p: any) => [p.id, p]))

  const enriched = posts.map((post: any) => ({
    ...post,
    author: profileMap.get(post.user_id) || { name: '—', avatar_url: null },
    pages: (pages.data || []).filter((p: any) => p.post_id === post.id),
    likes: (likes.data || []).filter((l: any) => l.post_id === post.id),
    comments: (comments.data || [])
      .filter((c: any) => c.post_id === post.id)
      .map((c: any) => ({
        ...c,
        author: profileMap.get(c.user_id) || { name: '—', avatar_url: null },
        likesCount: commentLikesData.filter((cl: any) => cl.comment_id === c.id).length,
        likedByMe: commentLikesData.some((cl: any) => cl.comment_id === c.id && cl.user_id === userId),
      })),
    likedByMe: (likes.data || []).some((l: any) => l.post_id === post.id && l.user_id === userId),
    likesCount: (likes.data || []).filter((l: any) => l.post_id === post.id).length,
    commentsCount: (comments.data || []).filter((c: any) => c.post_id === post.id).length,
    sharesCount: (shares.data || []).filter((s: any) => s.post_id === post.id).length,
  }))

  return {
    posts: enriched,
    nextCursor: posts.length === PAGE_SIZE ? posts[posts.length - 1].created_at : null,
  }
}

export function FeedPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [pulling, setPulling] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const touchStartY = useRef<number | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Load cached first page synchronously for instant display
  const cachedFirstPage = loadCache<FeedPage>(CACHE_KEY)

  const {
    data,
    isLoading,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['feed-posts', user?.id],
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam, user?.id || null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!user,
    initialData: cachedFirstPage
      ? { pages: [cachedFirstPage], pageParams: [null] }
      : undefined,
    staleTime: 1000 * 60 * 5,
  })

  // Persist first page to localStorage on every successful fetch
  useEffect(() => {
    if (data?.pages?.[0]) {
      saveCache(CACHE_KEY, data.pages[0])
    }
  }, [data])

  // IntersectionObserver: auto-load next page when sentinel is visible
  useEffect(() => {
    if (!sentinelRef.current || !hasNextPage || isFetchingNextPage) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) fetchNextPage()
      },
      { rootMargin: '500px' } // start loading 500px before sentinel is visible
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Pull to refresh handlers
  function handleTouchStart(e: React.TouchEvent) {
    if (window.scrollY > 0) return
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartY.current === null) return
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta > 0 && window.scrollY === 0) {
      setPulling(Math.min(delta, 100))
    }
  }

  async function handleTouchEnd() {
    if (pulling > 60) {
      setRefreshing(true)
      await refetch()
      setRefreshing(false)
    }
    setPulling(0)
    touchStartY.current = null
  }

  async function handleRefresh() {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  // Flatten posts from all pages
  const posts = data?.pages.flatMap((p) => p.posts) || []

  return (
    <div
      className="max-w-lg mx-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      {(pulling > 0 || refreshing) && (
        <div
          className="flex items-center justify-center py-4"
          style={{ height: refreshing ? 60 : pulling }}
        >
          <RefreshCw
            className={`w-6 h-6 text-red-veon ${refreshing ? 'animate-spin' : ''}`}
            style={{ transform: refreshing ? '' : `rotate(${pulling * 3}deg)` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Feed</h1>
          {isFetching && !refreshing && !isFetchingNextPage && posts.length > 0 && (
            <div className="w-3 h-3 border-2 border-red-veon border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <NotificationsBell />
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 bg-bg-card border border-navy-800 hover:border-navy-600 text-text-secondary hover:text-text-primary rounded-lg transition-colors disabled:opacity-50"
            title="Atualizar feed"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-red-veon hover:bg-red-veon-dark text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo Post
          </button>
        </div>
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

      {/* Skeleton (initial load only when no cache) */}
      {isLoading && posts.length === 0 && (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <PostSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && posts.length === 0 && !showCreate && (
        <div className="text-center py-20 text-text-muted">
          <p className="text-lg">Nenhum post ainda.</p>
          <p className="text-sm mt-1">Seja o primeiro a postar no feed!</p>
        </div>
      )}

      {/* Posts */}
      <div className="space-y-6">
        {posts.map((post: any) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {/* Infinite scroll sentinel + loading indicator */}
      {hasNextPage && (
        <div ref={sentinelRef} className="py-8 flex items-center justify-center">
          {isFetchingNextPage ? (
            <div className="flex items-center gap-2 text-text-muted">
              <div className="w-5 h-5 border-2 border-red-veon border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Carregando mais...</span>
            </div>
          ) : (
            <div className="h-6" />
          )}
        </div>
      )}

      {/* End of feed */}
      {!hasNextPage && posts.length > 0 && (
        <p className="text-center text-text-muted text-sm py-8">Você chegou ao fim do feed</p>
      )}
    </div>
  )
}

function PostSkeleton() {
  return (
    <div className="bg-bg-card border border-navy-800 rounded-2xl overflow-hidden animate-pulse">
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-full bg-navy-800" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-navy-800 rounded w-1/3" />
          <div className="h-2 bg-navy-800 rounded w-1/4" />
        </div>
      </div>
      <div className="aspect-[4/5] bg-navy-800" />
      <div className="p-4 space-y-2">
        <div className="h-3 bg-navy-800 rounded w-1/4" />
        <div className="h-3 bg-navy-800 rounded w-3/4" />
      </div>
    </div>
  )
}
