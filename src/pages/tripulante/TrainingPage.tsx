import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Play, CheckCircle, ChevronLeft, ChevronRight, X, ArrowLeft, SkipBack, SkipForward } from 'lucide-react'
import { VideoPlayer } from '../../components/VideoPlayer'

interface LessonWithProgress {
  id: string
  module_id: string
  title: string
  description: string | null
  youtube_url: string | null
  bunny_video_id: string | null
  sort_order: number
  watched?: boolean
}

function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/)
  return match ? match[1] : null
}

export function TrainingPage() {
  const { id: trainingId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [selectedLesson, setSelectedLesson] = useState<LessonWithProgress | null>(null)
  const [autoOpenDone, setAutoOpenDone] = useState(false)

  const logView = async (lessonId: string): Promise<string | null> => {
    if (!user) return null
    const { data } = await supabase
      .from('lesson_views')
      .insert({ user_id: user.id, lesson_id: lessonId })
      .select('id')
      .single()
    return data?.id ?? null
  }

  const { data: training } = useQuery({
    queryKey: ['training-info', trainingId],
    queryFn: async () => {
      const { data } = await supabase.from('trainings').select('*').eq('id', trainingId!).single()
      return data
    },
    enabled: !!trainingId,
  })

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ['training-modules', trainingId, user?.id],
    queryFn: async () => {
      const { data: modulesData } = await supabase
        .from('modules')
        .select('*')
        .eq('training_id', trainingId!)
        .order('sort_order')

      if (!modulesData?.length) return []

      const moduleIds = modulesData.map(m => m.id)

      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('*')
        .in('module_id', moduleIds)
        .order('sort_order')

      const { data: progressData } = await supabase
        .from('lesson_progress')
        .select('lesson_id, watched')
        .eq('user_id', user!.id)

      const progressMap = new Map((progressData || []).map((p: any) => [p.lesson_id, p.watched]))

      return modulesData.map(mod => ({
        ...mod,
        lessons: (lessonsData || [])
          .filter((l: any) => l.module_id === mod.id)
          .map((l: any) => ({ ...l, watched: progressMap.get(l.id) || false }))
      }))
    },
    enabled: !!user && !!trainingId,
  })

  const markWatched = useMutation({
    mutationFn: async (lessonId: string) => {
      await supabase.from('lesson_progress').upsert({
        user_id: user!.id,
        lesson_id: lessonId,
        watched: true,
        watched_at: new Date().toISOString(),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-modules'] })
    },
  })

  const unmarkWatched = useMutation({
    mutationFn: async (lessonId: string) => {
      await supabase.from('lesson_progress').upsert({
        user_id: user!.id,
        lesson_id: lessonId,
        watched: false,
        watched_at: null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-modules'] })
    },
  })

  // Auto-open lesson from ?aula= query param
  useEffect(() => {
    if (autoOpenDone || !modules.length) return
    const aulaId = searchParams.get('aula')
    if (!aulaId) { setAutoOpenDone(true); return }

    for (const mod of modules) {
      const lesson = (mod as any).lessons?.find((l: any) => l.id === aulaId)
      if (lesson) {
        logView(lesson.id)
        setSelectedLesson(lesson)
        setAutoOpenDone(true)
        return
      }
    }
    setAutoOpenDone(true)
  }, [modules, autoOpenDone, searchParams])

  function selectLesson(lesson: LessonWithProgress) {
    logView(lesson.id)
    setSelectedLesson(lesson)
    setSearchParams({ aula: lesson.id }, { replace: true })
  }

  function closeLesson() {
    setSelectedLesson(null)
    setSearchParams({}, { replace: true })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-red-veon border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header: logo + slogan */}
      <div className="flex items-center justify-between py-4 mb-6 border-b border-white/10">
        <img src="/veon-logo.png" alt="Instituto Veon" className="h-[46px] md:h-[55px] object-contain" />
        <span className="text-base md:text-lg font-bold italic text-white/90 tracking-wide">A Escola do Varejo</span>
      </div>

      <button
        onClick={() => navigate('/treinamentos')}
        className="flex items-center gap-2 text-text-muted hover:text-text-primary mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar aos treinamentos
      </button>

      <h1 className="text-2xl font-bold mb-2">{training?.title || 'Treinamento'}</h1>
      {training?.description && (
        <p className="text-text-secondary mb-8">{training.description}</p>
      )}

      {modules.length > 0 && (() => {
        const nextLesson = modules.reduce<{ lesson: LessonWithProgress; moduleName: string } | null>((found, mod: any) => {
          if (found) return found
          const unwatched = mod.lessons.find((l: LessonWithProgress) => !l.watched)
          return unwatched ? { lesson: unwatched, moduleName: mod.title } : null
        }, null)

        return nextLesson ? (
          <div className="mb-8 bg-bg-card border border-navy-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-text-muted mb-3">Continuar Assistindo</h3>
            <button
              onClick={() => selectLesson(nextLesson.lesson)}
              className="flex items-center gap-4 w-full text-left hover:bg-navy-800/50 rounded-lg p-2 -m-2 transition-colors"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-veon flex items-center justify-center">
                <Play className="w-5 h-5 text-white" fill="white" />
              </div>
              <div className="min-w-0">
                <p className="text-text-primary font-medium truncate">{nextLesson.lesson.title}</p>
                <p className="text-xs text-text-muted">{nextLesson.moduleName}</p>
              </div>
            </button>
          </div>
        ) : (
          <div className="mb-8 bg-bg-card border border-green-500/30 rounded-xl p-5 text-center">
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-text-primary font-medium">Parabéns! Você completou este treinamento.</p>
          </div>
        )
      })()}

      {modules.length === 0 ? (
        <div className="text-center py-20 text-text-muted">
          <p className="text-lg">Nenhum módulo disponível neste treinamento.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {modules.map((mod: any) => (
            <ModuleRow
              key={mod.id}
              module={mod}
              onSelectLesson={(lesson) => selectLesson(lesson)}
            />
          ))}
        </div>
      )}

      {selectedLesson && (() => {
        const currentModule = modules.find((mod: any) =>
          mod.lessons?.some((l: any) => l.id === selectedLesson.id)
        )
        const moduleLessons: LessonWithProgress[] = currentModule?.lessons || []

        return (
          <VideoModal
            lesson={selectedLesson}
            moduleLessons={moduleLessons}
            onClose={closeLesson}
            onMarkWatched={(id) => {
              markWatched.mutate(id)
              setSelectedLesson(prev => prev ? { ...prev, watched: true } : null)
            }}
            onUnmarkWatched={(id) => {
              unmarkWatched.mutate(id)
              setSelectedLesson(prev => prev ? { ...prev, watched: false } : null)
            }}
            onNavigate={(lesson) => {
              selectLesson(lesson)
            }}
          />
        )
      })()}
    </div>
  )
}

function ModuleRow({
  module: mod,
  onSelectLesson,
}: {
  module: any
  onSelectLesson: (lesson: LessonWithProgress) => void
}) {
  const scrollContainer = (id: string, direction: 'left' | 'right') => {
    const el = document.getElementById(id)
    if (el) el.scrollBy({ left: direction === 'left' ? -320 : 320, behavior: 'smooth' })
  }

  const completedCount = mod.lessons.filter((l: any) => l.watched).length

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center gap-4 mb-2">
          <h2 className="text-xl font-semibold text-text-primary">{mod.title}</h2>
          {mod.lessons.length > 0 && (
            <span className="text-xs text-text-muted">
              {Math.round((completedCount / mod.lessons.length) * 100)}% ({completedCount}/{mod.lessons.length} concluídas)
            </span>
          )}
        </div>
        {mod.lessons.length > 0 && (
          <div className="w-full bg-navy-900 rounded-full h-2 max-w-md">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.round((completedCount / mod.lessons.length) * 100)}%` }}
            />
          </div>
        )}
      </div>
      {mod.description && <p className="text-sm text-text-secondary mb-4">{mod.description}</p>}

      <div className="relative group">
        <button
          onClick={() => scrollContainer(`module-${mod.id}`, 'left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-bg-primary/80 hover:bg-bg-card p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => scrollContainer(`module-${mod.id}`, 'right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-bg-primary/80 hover:bg-bg-card p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div
          id={`module-${mod.id}`}
          className="flex gap-4 overflow-x-auto pb-4"
          style={{ scrollbarWidth: 'none' }}
        >
          {mod.lessons.map((lesson: any) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              onClick={() => onSelectLesson(lesson)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function LessonCard({
  lesson,
  onClick,
}: {
  lesson: LessonWithProgress
  onClick: () => void
}) {
  const ytId = lesson.youtube_url ? extractYoutubeId(lesson.youtube_url) : null
  const bunnyId = lesson.bunny_video_id
  const thumbnail = (lesson as any).thumbnail_url
    || (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null)
    || (bunnyId ? `https://vz-6d04ab5b-6ae.b-cdn.net/${bunnyId}/thumbnail.jpg` : null)

  return (
    <div className={`flex-shrink-0 w-60 md:w-72 bg-bg-card border rounded-xl overflow-hidden hover:border-navy-600 transition-colors group/card ${
      lesson.watched ? 'border-green-800/50' : 'border-navy-800'
    }`}>
      <div className="relative cursor-pointer" onClick={onClick}>
        {thumbnail ? (
          <img src={thumbnail} alt={lesson.title} className={`w-full h-40 object-cover ${lesson.watched ? 'opacity-75' : ''}`} />
        ) : (
          <div className="w-full h-40 bg-navy-900 flex items-center justify-center">
            <Play className="w-10 h-10 text-text-muted" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity">
          <Play className="w-12 h-12 text-white" fill="white" />
        </div>
        {lesson.watched && (
          <div className="absolute top-2 right-2 bg-green-600 rounded-full p-1">
            <CheckCircle className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start gap-2">
          <h3 className="text-sm font-medium text-text-primary line-clamp-2 mb-1 flex-1">{lesson.title}</h3>
        </div>
        {lesson.watched ? (
          <span className="text-xs text-green-400">Concluída</span>
        ) : (
          lesson.description && <p className="text-xs text-text-muted line-clamp-2">{lesson.description}</p>
        )}
      </div>
    </div>
  )
}


function VideoModal({
  lesson,
  moduleLessons,
  onClose,
  onMarkWatched,
  onUnmarkWatched,
  onNavigate,
}: {
  lesson: LessonWithProgress
  moduleLessons: LessonWithProgress[]
  onClose: () => void
  onMarkWatched: (id: string) => void
  onUnmarkWatched: (id: string) => void
  onNavigate: (lesson: LessonWithProgress) => void
}) {
  const { user } = useAuth()
  const ytId = lesson.youtube_url ? extractYoutubeId(lesson.youtube_url) : null
  const bunnyId = lesson.bunny_video_id

  const [justMarked, setJustMarked] = useState(false)
  const openTimeRef = useRef(Date.now())
  const viewIdRef = useRef<string | null>(null)

  // Navigation: find prev/next in same module
  const currentIndex = moduleLessons.findIndex(l => l.id === lesson.id)
  const prevLesson = currentIndex > 0 ? moduleLessons[currentIndex - 1] : null
  const nextLesson = currentIndex < moduleLessons.length - 1 ? moduleLessons[currentIndex + 1] : null

  // Reset justMarked when lesson changes
  useEffect(() => {
    setJustMarked(false)
  }, [lesson.id])

  // Log view on mount and get the view ID
  useEffect(() => {
    openTimeRef.current = Date.now()
    viewIdRef.current = null
    async function logOpen() {
      if (!user) return
      const { data } = await supabase
        .from('lesson_views')
        .insert({ user_id: user.id, lesson_id: lesson.id })
        .select('id')
        .single()
      if (data) viewIdRef.current = data.id
    }
    logOpen()
  }, [user, lesson.id])

  // Close handler: update duration on the view record
  const handleClose = useCallback(async () => {
    const elapsed = Math.round((Date.now() - openTimeRef.current) / 1000)
    if (viewIdRef.current) {
      await supabase
        .from('lesson_views')
        .update({ duration_seconds: elapsed })
        .eq('id', viewIdRef.current)
    }
    onClose()
  }, [onClose])

  function handleMarkCompleted() {
    onMarkWatched(lesson.id)
    setJustMarked(true)
  }

  // ESC key handler
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleClose])

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            {lesson.watched && (
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            )}
            <h2 className="text-lg font-semibold text-text-primary truncate">{lesson.title}</h2>
            {moduleLessons.length > 1 && (
              <span className="text-xs text-text-muted flex-shrink-0">
                {currentIndex + 1}/{moduleLessons.length}
              </span>
            )}
          </div>
          <button onClick={handleClose} className="text-text-muted hover:text-text-primary flex-shrink-0 ml-4">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Video */}
        {bunnyId ? (
          <VideoPlayer videoId={bunnyId} autoplay />
        ) : ytId ? (
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              className="absolute inset-0 w-full h-full rounded-xl"
              src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
              title={lesson.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="bg-bg-card rounded-xl p-20 text-center text-text-muted">
            Vídeo não disponível
          </div>
        )}

        {/* Controls bar */}
        <div className="mt-4 flex items-center justify-between gap-4">
          {/* Prev button */}
          <button
            onClick={() => prevLesson && onNavigate(prevLesson)}
            disabled={!prevLesson}
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-colors ${
              prevLesson
                ? 'bg-bg-card text-text-secondary hover:text-text-primary hover:bg-navy-800'
                : 'bg-bg-card/50 text-text-muted/30 cursor-not-allowed'
            }`}
          >
            <SkipBack className="w-4 h-4" /> Anterior
          </button>

          {/* Mark / Unmark as completed */}
          {lesson.watched ? (
            <button
              onClick={() => onUnmarkWatched(lesson.id)}
              className="flex items-center gap-2 bg-green-600/20 hover:bg-red-600/20 border border-green-500/30 hover:border-red-500/30 text-green-400 hover:text-red-400 text-sm px-5 py-2.5 rounded-lg transition-colors group/btn"
            >
              <CheckCircle className="w-4 h-4" />
              <span className="group-hover/btn:hidden">Aula concluída</span>
              <span className="hidden group-hover/btn:inline">Desmarcar</span>
            </button>
          ) : (
            <button
              onClick={handleMarkCompleted}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              <CheckCircle className="w-4 h-4" /> Marcar como concluída
            </button>
          )}

          {/* Next button */}
          <button
            onClick={() => nextLesson && onNavigate(nextLesson)}
            disabled={!nextLesson}
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-colors ${
              nextLesson
                ? 'bg-bg-card text-text-secondary hover:text-text-primary hover:bg-navy-800'
                : 'bg-bg-card/50 text-text-muted/30 cursor-not-allowed'
            }`}
          >
            Próxima <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Just marked notification + go to next */}
        {justMarked && nextLesson && (
          <div className="mt-3 flex items-center justify-between bg-green-600/20 border border-green-500/30 text-green-400 text-sm px-4 py-3 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Aula concluída!
            </div>
            <button
              onClick={() => onNavigate(nextLesson)}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              Ir para próxima aula <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Description and materials */}
        <div className="mt-3 space-y-3">
          {lesson.description && <p className="text-sm text-text-secondary">{lesson.description}</p>}
          {(lesson as any).material_url && (
            <a
              href={(lesson as any).material_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-sm px-4 py-2 rounded-lg transition-colors border border-blue-600/30"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              {(lesson as any).material_name || 'Material de Apoio'}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
