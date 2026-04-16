import { AlertCircle, RefreshCw, Trash2 } from 'lucide-react'
import { useUploadStore } from '../../stores/uploadStore'
import { retryPostUpload, discardPost } from '../../lib/postUploadManager'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import { Spinner } from '../ui/Spinner'

interface Props {
  post: {
    id: string
    status: 'uploading' | 'processing' | 'ready' | 'failed'
    failed_reason?: string | null
  }
}

export function UploadingMedia({ post }: Props) {
  const entry = useUploadStore((s) => s.byPostId[post.id])
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const dbFailed = post.status === 'failed'
  const failed = dbFailed || entry?.status === 'failed'
  const orphaned = post.status === 'uploading' && !entry

  const progress = entry?.progress ?? 0
  const errorMsg = entry?.error || post.failed_reason || 'Erro desconhecido'

  type CachedFeed = { pages: Array<{ posts: Array<Record<string, unknown>>; nextCursor: string | null }>; pageParams: Array<string | null> }

  function removeFromCache() {
    if (!user) return
    queryClient.setQueryData<CachedFeed>(['feed-posts', user.id], (old) => {
      if (!old) return old
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          posts: page.posts.filter((p) => p.id !== post.id),
        })),
      }
    })
  }

  async function handleRetry() {
    await retryPostUpload(post.id, 'posts')
    if (user) {
      queryClient.setQueryData<CachedFeed>(['feed-posts', user.id], (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            posts: page.posts.map((p) =>
              p.id === post.id ? { ...p, status: 'uploading', failed_reason: null } : p,
            ),
          })),
        }
      })
    }
  }

  async function handleDiscard() {
    await discardPost(post.id)
    removeFromCache()
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-navy-900 to-navy-950 animate-pulse-slow">
      {/* Shimmering placeholder layer */}
      <div className="absolute inset-0 bg-navy-800/40 animate-pulse" />

      <div className="relative z-10 flex flex-col items-center justify-center gap-3 px-6 text-center w-full max-w-xs">
        {failed ? (
          <>
            <AlertCircle className="w-10 h-10 text-red-veon" />
            <p className="text-sm font-semibold text-white">Problema ao enviar</p>
            <p className="text-xs text-text-secondary line-clamp-3">{errorMsg}</p>
            {!entry?.retryContext && (
              <p className="text-[11px] text-text-muted mt-1 max-w-[260px]">
                Feche e publique novamente para tentar.
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              {entry?.retryContext && (entry.retries ?? 0) < 3 && (
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-1.5 bg-red-veon hover:bg-red-veon/90 text-white text-xs font-semibold px-3 py-2 rounded-lg"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
                </button>
              )}
              <button
                onClick={handleDiscard}
                className="flex items-center gap-1.5 bg-navy-800 hover:bg-navy-700 text-white text-xs font-semibold px-3 py-2 rounded-lg"
              >
                <Trash2 className="w-3.5 h-3.5" /> Descartar
              </button>
            </div>
          </>
        ) : orphaned ? (
          <>
            <AlertCircle className="w-10 h-10 text-yellow-500" />
            <p className="text-sm font-semibold text-white">Envio não concluído</p>
            <p className="text-xs text-text-secondary">
              Iniciado em outra sessão. Descarte e publique novamente.
            </p>
            <button
              onClick={handleDiscard}
              className="flex items-center gap-1.5 bg-navy-800 hover:bg-navy-700 text-white text-xs font-semibold px-3 py-2 rounded-lg mt-2"
            >
              <Trash2 className="w-3.5 h-3.5" /> Descartar
            </button>
          </>
        ) : (
          <>
            <Spinner size="md" />
            <p className="text-sm font-semibold text-white">Enviando publicação… {progress}%</p>
            <div className="w-full h-1.5 bg-navy-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-veon transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-text-muted">Só você pode ver este post até terminar.</p>
          </>
        )}
      </div>
    </div>
  )
}
