import { useState, useRef, useEffect } from 'react'
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Plus, RefreshCw, Users } from 'lucide-react'
import { CreatePostWizard } from '../../components/feed/CreatePostWizard'
import { PostCard } from '../../components/feed/PostCard'
import { NotificationsBell } from '../../components/feed/NotificationsBell'
import { FriendsModal } from '../../components/feed/FriendsModal'
import { saveCache, loadCache } from '../../lib/feedCache'
import { useUploadStore } from '../../stores/uploadStore'
import { useFeedReadyStore } from '../../stores/feedReadyStore'
import { PostCardSkeleton } from '../../components/feed/PostCardSkeleton'

const PAGE_SIZE = 5
const CACHE_KEY = 'feed-first-page'
const INITIAL_BUDGET = 3              // # of top posts that gate the cold-start scroll lock
const SCROLL_LOCK_TIMEOUT_MS = 2000   // failsafe — never lock longer than this

interface FeedPage {
  posts: any[]
  nextCursor: string | null
}

async function fetchFeedPage(cursor: string | null, userId: string | null, fetchNewer = false, newerThan?: string): Promise<FeedPage> {
  let query = supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)

  // Only 'ready' posts are visible to everyone; author additionally sees their own in-flight posts.
  if (userId) {
    query = query.or(`status.eq.ready,user_id.eq.${userId}`)
  } else {
    query = query.eq('status', 'ready')
  }

  if (fetchNewer && newerThan) {
    // Fetch only posts newer than the most recent we have
    query = query.gt('created_at', newerThan)
  } else if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data: posts } = await query
  if (!posts || posts.length === 0) return { posts: [], nextCursor: null }

  const postIds = posts.map((p: any) => p.id)
  const userIds = [...new Set(posts.map((p: any) => p.user_id))]

  const [pages, likes, comments, shares, views, profiles] = await Promise.all([
    supabase.from('post_pages').select('*').in('post_id', postIds).order('sort_order'),
    supabase.from('post_likes').select('*').in('post_id', postIds),
    supabase.from('post_comments').select('*').in('post_id', postIds).order('created_at'),
    supabase.from('post_shares').select('post_id').in('post_id', postIds),
    supabase.from('post_views').select('post_id').in('post_id', postIds),
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
    viewsCount: (views.data || []).filter((v: any) => v.post_id === post.id).length,
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
  const [showFriends, setShowFriends] = useState(false)
  const [pulling, setPulling] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const touchStartY = useRef<number | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const mergeRef = useRef<() => Promise<void>>(async () => {})
  const realtimeDebounceRef = useRef<number | null>(null)

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
    staleTime: 1000 * 30,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })

  // Persist first page to localStorage on every successful fetch
  useEffect(() => {
    if (data?.pages?.[0]) {
      saveCache(CACHE_KEY, data.pages[0])
    }
  }, [data])

  // Realtime: listen for new/updated posts and pull them in without reload.
  // Realtime: listen ONLY for UPDATE events on posts.
  // When a post transitions to status='ready', we fetch and prepend it.
  // We do NOT listen to INSERT because:
  //  - New posts are always inserted as status='uploading' (invisible to others)
  //  - The author already gets instant feedback via cache seeding in CreatePostWizard
  //  - Listening to INSERT + UPDATE caused duplicate fetches and race conditions
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('feed-posts-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, () => {
        if (realtimeDebounceRef.current) {
          window.clearTimeout(realtimeDebounceRef.current)
        }
        realtimeDebounceRef.current = window.setTimeout(() => {
          mergeRef.current().catch(() => {})
        }, 800)
      })
      .subscribe()
    return () => {
      if (realtimeDebounceRef.current) {
        window.clearTimeout(realtimeDebounceRef.current)
      }
      supabase.removeChannel(channel)
    }
  }, [user])

  // Cold-start scroll lock: only when there's NO cached first page.
  // Releases as soon as INITIAL_BUDGET posts mark themselves ready, or after the failsafe.
  useEffect(() => {
    if (cachedFirstPage) return
    useFeedReadyStore.getState().resetInitial(INITIAL_BUDGET)
    document.body.style.overflow = 'hidden'
    const release = () => {
      document.body.style.overflow = ''
    }
    const failsafe = window.setTimeout(release, SCROLL_LOCK_TIMEOUT_MS)
    const unsub = useFeedReadyStore.subscribe((s) => {
      if (s.initialReadyCount >= INITIAL_BUDGET) release()
    })
    return () => {
      window.clearTimeout(failsafe)
      unsub()
      release()
    }
    // intentionally empty deps: only runs on mount; cachedFirstPage is captured
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Preload the first post's hero image so it races with the JS bundle
  useEffect(() => {
    const firstPost = data?.pages?.[0]?.posts?.[0]
    const firstPage = firstPost?.pages?.[0]
    const href = firstPage?.thumbnail_url || firstPage?.image_url
    if (!href || firstPage?.type === 'audio') return
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = href
    link.fetchPriority = 'high'
    document.head.appendChild(link)
    return () => {
      document.head.removeChild(link)
    }
  }, [data])

  // Zombie sweep: if one of the user's own posts is stuck in 'uploading' with no
  // active upload entry in the store AND was started >10min ago, mark it failed.
  useEffect(() => {
    if (!user || !data) return
    const store = useUploadStore.getState()
    const cutoff = Date.now() - 10 * 60 * 1000
    const zombieIds: string[] = []
    for (const page of data.pages) {
      for (const post of page.posts) {
        if (
          post.user_id === user.id &&
          post.status === 'uploading' &&
          !store.byPostId[post.id] &&
          post.upload_started_at &&
          new Date(post.upload_started_at).getTime() < cutoff
        ) {
          zombieIds.push(post.id)
        }
      }
    }
    if (zombieIds.length === 0) return
    supabase
      .from('posts')
      .update({ status: 'failed', failed_reason: 'Upload interrompido' })
      .in('id', zombieIds)
      .then(() => {
        queryClient.setQueryData<InfiniteData<FeedPage, string | null>>(
          ['feed-posts', user.id],
          (old) => {
            if (!old) return old
            return {
              ...old,
              pages: old.pages.map((p) => ({
                ...p,
                posts: p.posts.map((post: any) =>
                  zombieIds.includes(post.id)
                    ? { ...post, status: 'failed', failed_reason: 'Upload interrompido' }
                    : post,
                ),
              })),
            }
          },
        )
      })
  }, [data, user, queryClient])

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

  // Refresh: fetch only NEWER posts and prepend (don't lose older ones)
  async function fetchNewerAndMerge() {
    if (!user) return
    setRefreshing(true)
    try {
      // Use the most recent READY post as cutoff — NOT the absolute most recent,
      // because an in-flight post of our own (status='uploading') would make us
      // skip friends' ready posts that are older than our upload but newer than
      // the last ready post in feed.
      const currentPosts = data?.pages.flatMap((p) => p.posts) || []
      const mostRecentReady = currentPosts.find((p: any) => p.status === 'ready')
      const mostRecentDate = mostRecentReady?.created_at || null

      if (!mostRecentDate) {
        // No existing posts — do a normal refetch
        await refetch()
        return
      }

      // Fetch only newer posts
      const newerPage = await fetchFeedPage(null, user.id, true, mostRecentDate)

      if (newerPage.posts.length > 0) {
        // Merge: add new posts to the start of the first page, dedupe by id
        queryClient.setQueryData<InfiniteData<FeedPage, string | null>>(
          ['feed-posts', user.id],
          (old) => {
            if (!old) return old
            const existingIds = new Set(old.pages.flatMap((p) => p.posts.map((post: any) => post.id)))
            const trulyNew = newerPage.posts.filter((p: any) => !existingIds.has(p.id))
            if (trulyNew.length === 0) return old

            const newPages = [...old.pages]
            newPages[0] = {
              ...newPages[0],
              posts: [...trulyNew, ...newPages[0].posts],
            }
            return { ...old, pages: newPages }
          }
        )
      }
    } finally {
      setRefreshing(false)
    }
  }

  // Keep the latest merge function reachable from the Realtime effect
  // without re-subscribing on every render.
  mergeRef.current = fetchNewerAndMerge

  async function handleTouchEnd() {
    if (pulling > 60) {
      await fetchNewerAndMerge()
    }
    setPulling(0)
    touchStartY.current = null
  }

  async function handleRefresh() {
    await fetchNewerAndMerge()
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
          <button
            onClick={() => setShowFriends(true)}
            className="p-2.5 bg-bg-card border border-navy-800 hover:border-navy-600 text-text-secondary hover:text-text-primary rounded-lg transition-colors"
            title="Comunidade"
          >
            <Users className="w-4 h-4" />
          </button>
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
            // Cache is already seeded by CreatePostWizard — no invalidation
            // needed. A full refetch here would race with the Realtime
            // subscription and potentially duplicate the post in the cache.
          }}
        />
      )}

      {showFriends && <FriendsModal onClose={() => setShowFriends(false)} />}

      {/* Skeleton (initial load only when no cache) */}
      {isLoading && posts.length === 0 && (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <PostCardSkeleton key={i} />
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
        {posts.map((post: any, idx: number) => (
          <PostCard
            key={post.id}
            post={post}
            priority={idx === 0}
            isInitial={idx < INITIAL_BUDGET}
          />
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

