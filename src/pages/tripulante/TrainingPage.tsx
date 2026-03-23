import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Play, CheckCircle, ChevronLeft, ChevronRight, X, ArrowLeft } from 'lucide-react'
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
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [selectedLesson, setSelectedLesson] = useState<LessonWithProgress | null>(null)

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-red-veon border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => navigate('/treinamentos')}
        className="flex items-center gap-2 text-text-muted hover:text-text-primary mb-6 transition-colors"
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
              onClick={() => { logView(nextLesson.lesson.id); setSelectedLesson(nextLesson.lesson) }}
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
              onSelectLesson={(lesson) => { logView(lesson.id); setSelectedLesson(lesson) }}
            />
          ))}
        </div>
      )}

      {selectedLesson && (
        <VideoModal
          lesson={selectedLesson}
          onClose={() => setSelectedLesson(null)}
          onMarkWatched={(id) => {
            markWatched.mutate(id)
            setSelectedLesson(prev => prev ? { ...prev, watched: true } : null)
          }}
        />
      )}
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
    <div className="flex-shrink-0 w-60 md:w-72 bg-bg-card border border-navy-800 rounded-xl overflow-hidden hover:border-navy-600 transition-colors group/card">
      <div className="relative cursor-pointer" onClick={onClick}>
        {thumbnail ? (
          <img src={thumbnail} alt={lesson.title} className="w-full h-40 object-cover" />
        ) : (
          <div className="w-full h-40 bg-navy-900 flex items-center justify-center">
            <Play className="w-10 h-10 text-text-muted" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity">
          <Play className="w-12 h-12 text-white" fill="white" />
        </div>
        {lesson.watched && (
          <div className="absolute top-2 right-2">
            <CheckCircle className="w-6 h-6 text-green-400" fill="rgba(34,197,94,0.2)" />
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-sm font-medium text-text-primary line-clamp-2 mb-1">{lesson.title}</h3>
        {lesson.description && <p className="text-xs text-text-muted line-clamp-2">{lesson.description}</p>}
      </div>
    </div>
  )
}

function VideoModal({
  lesson,
  onClose,
  onMarkWatched,
}: {
  lesson: LessonWithProgress
  onClose: () => void
  onMarkWatched: (id: string) => void
}) {
  const { user } = useAuth()
  const ytId = lesson.youtube_url ? extractYoutubeId(lesson.youtube_url) : null
  const bunnyId = lesson.bunny_video_id

  const [autoWatched, setAutoWatched] = useState(false)
  const openTimeRef = useRef(Date.now())
  const viewIdRef = useRef<string | null>(null)

  // Log view on mount and get the view ID
  useEffect(() => {
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

  // Called when video reaches 90%+ or ends
  const handleVideoComplete = useCallback(() => {
    if (lesson.watched || autoWatched) return
    onMarkWatched(lesson.id)
    setAutoWatched(true)
  }, [lesson.watched, lesson.id, onMarkWatched, autoWatched])

  // Fade out auto-watched notification after 3 seconds
  useEffect(() => {
    if (!autoWatched) return
    const timeout = setTimeout(() => setAutoWatched(false), 3000)
    return () => clearTimeout(timeout)
  }, [autoWatched])

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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">{lesson.title}</h2>
          <button onClick={handleClose} className="text-text-muted hover:text-text-primary">
            <X className="w-6 h-6" />
          </button>
        </div>

        {bunnyId ? (
          <VideoPlayer videoId={bunnyId} autoplay onVideoComplete={handleVideoComplete} />
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

        <div className="mt-4 space-y-3">
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

        {/* Auto-watched notification */}
        {autoWatched && (
          <div className="mt-3 flex items-center gap-2 bg-green-600/20 border border-green-500/30 text-green-400 text-sm px-4 py-2 rounded-lg animate-pulse">
            <CheckCircle className="w-4 h-4" /> Aula marcada como assistida
          </div>
        )}
      </div>
    </div>
  )
}
