import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { GraduationCap, User, ChevronLeft, ChevronRight, Lock, Mic, Play } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const PREVIEW_SECONDS = 15

export function PublicPostPage() {
  const { postId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  // Save ref to localStorage for later use during signup
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) {
      localStorage.setItem('referral_id', ref)
    }
  }, [searchParams])

  const [post, setPost] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!postId) return
    ;(async () => {
      const { data } = await supabase.from('posts').select('*').eq('id', postId).eq('status', 'ready').single()
      if (!data) { setLoading(false); return }

      const [pagesRes, profileRes, likesRes, commentsRes] = await Promise.all([
        supabase.from('post_pages').select('*').eq('post_id', postId).order('sort_order'),
        supabase.from('profiles').select('name, avatar_url, profession').eq('id', data.user_id).single(),
        supabase.from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', postId),
        supabase.from('post_comments').select('*', { count: 'exact', head: true }).eq('post_id', postId),
      ])

      setPost({
        ...data,
        pages: pagesRes.data || [],
        author: profileRes.data || { name: '—', avatar_url: null },
        likesCount: likesRes.count || 0,
        commentsCount: commentsRes.count || 0,
      })
      setLoading(false)
    })()
  }, [postId])

  // If logged in, redirect to the real post view in the feed
  useEffect(() => {
    if (user && postId) {
      // Give a small delay to show the preview
      // Actually: go straight to feed with the post highlighted
      // Or show the full post modal... let's just navigate to feed
    }
  }, [user, postId])

  // Video preview: stop at 15 seconds
  useEffect(() => {
    if (!videoRef.current || user) return
    const video = videoRef.current
    function onTimeUpdate() {
      if (video.currentTime >= PREVIEW_SECONDS) {
        video.pause()
        video.currentTime = PREVIEW_SECONDS
      }
    }
    video.addEventListener('timeupdate', onTimeUpdate)
    return () => video.removeEventListener('timeupdate', onTimeUpdate)
  }, [user, currentPage])

  function handleCTAClick() {
    // Go to viral signup page
    navigate('/cadastro')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-veon border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        <div className="text-center">
          <GraduationCap className="w-12 h-12 text-red-veon mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-text-primary mb-2">Post não encontrado</h1>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 bg-red-veon hover:bg-red-veon-dark text-white px-6 py-2.5 rounded-lg"
          >
            Ir para a Academia
          </button>
        </div>
      </div>
    )
  }

  const currentPageData = post.pages[currentPage]
  const isLoggedIn = !!user

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Top nav */}
      <div className="sticky top-0 z-30 bg-bg-primary/95 backdrop-blur-md border-b border-navy-800">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-red-veon" />
            <div>
              <h1 className="text-base font-bold text-text-primary leading-tight">Academia Veon</h1>
              <p className="text-xs text-text-muted leading-tight">Comunidade exclusiva</p>
            </div>
          </div>
          {!isLoggedIn && (
            <button
              onClick={handleCTAClick}
              className="bg-red-veon hover:bg-red-veon-dark text-white text-sm font-semibold px-4 py-2 rounded-lg"
            >
              Entrar
            </button>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4">
        {/* Post */}
        <div className="bg-bg-card border border-navy-800 rounded-2xl overflow-hidden">
          {/* Author */}
          <div className="flex items-center gap-3 p-4">
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

          {/* Content */}
          <div className="relative aspect-[4/5] bg-navy-900">
            {currentPageData?.type === 'image' && currentPageData.image_url && (
              <>
                <img src={currentPageData.image_url} alt="" className="w-full h-full object-cover" />
                {!isLoggedIn && currentPage > 0 && (
                  <div className="absolute inset-0 backdrop-blur-xl bg-black/30 flex items-center justify-center">
                    <div className="bg-black/70 rounded-full p-4">
                      <Lock className="w-8 h-8 text-white" />
                    </div>
                  </div>
                )}
              </>
            )}
            {currentPageData?.type === 'video' && currentPageData.image_url && (
              <video
                ref={videoRef}
                key={currentPageData.id}
                src={currentPageData.image_url}
                className="w-full h-full object-cover"
                controls
                playsInline
                autoPlay
                muted
              />
            )}
            {currentPageData?.type === 'audio' && currentPageData.image_url && (
              <div className="w-full h-full bg-gradient-to-br from-green-900/50 to-navy-900 flex flex-col items-center justify-center p-8">
                <div className="w-24 h-24 rounded-full bg-green-600 flex items-center justify-center mb-4">
                  <Play className="w-10 h-10 text-white ml-1" />
                </div>
                <Mic className="w-5 h-5 text-text-muted" />
                <p className="text-xs text-text-muted mt-2">Áudio — faça login para ouvir</p>
              </div>
            )}

            {/* Video preview limit overlay */}
            {currentPageData?.type === 'video' && !isLoggedIn && (
              <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full">
                Prévia de {PREVIEW_SECONDS}s
              </div>
            )}

            {/* Carousel arrows */}
            {post.pages.length > 1 && (
              <>
                {currentPage > 0 && (
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                {currentPage < post.pages.length - 1 && (
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full">
                  {currentPage + 1}/{post.pages.length}
                </div>
              </>
            )}

            {/* Watermark */}
            <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded flex items-center gap-1">
              <GraduationCap className="w-3 h-3" />
              Academia Veon
            </div>
          </div>

          {/* Stats */}
          <div className="p-4 flex items-center gap-4 text-sm text-text-muted">
            <span>❤️ {post.likesCount} curtidas</span>
            <span>💬 {post.commentsCount} comentários</span>
          </div>

          {post.caption && (
            <p className="px-4 pb-4 text-sm">
              <span className="font-semibold text-text-primary">{post.author.name}</span>{' '}
              <span className="text-text-secondary whitespace-pre-line">{post.caption}</span>
            </p>
          )}
        </div>

        {/* CTA block */}
        {!isLoggedIn && (
          <div className="bg-gradient-to-br from-red-veon to-red-veon-dark rounded-2xl p-6 mt-4 text-center text-white">
            <GraduationCap className="w-12 h-12 mx-auto mb-3" />
            <h2 className="text-xl font-bold mb-2">Quer ver o conteúdo completo?</h2>
            <p className="text-sm text-white/90 mb-5">
              Entre na Academia Veon e tenha acesso a treinamentos exclusivos, comunidade e muito mais.
            </p>
            <button
              onClick={handleCTAClick}
              className="w-full bg-white text-red-veon hover:bg-gray-100 font-semibold py-3 rounded-lg transition-colors"
            >
              Entrar ou Criar conta
            </button>
          </div>
        )}

        {isLoggedIn && (
          <button
            onClick={() => navigate('/comunidade')}
            className="w-full mt-4 bg-bg-card border border-navy-800 hover:border-navy-600 text-text-primary py-3 rounded-lg transition-colors text-sm"
          >
            Ir para o Feed
          </button>
        )}
      </div>
    </div>
  )
}
