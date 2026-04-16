import { useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { Play, CheckCircle, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'

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
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

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

  // Auto-redirect ?aula= to new lesson page
  useEffect(() => {
    const aulaId = searchParams.get('aula')
    if (aulaId && trainingId) {
      navigate(`/treinamentos/${trainingId}/aula/${aulaId}`, { replace: true })
    }
  }, [searchParams, trainingId, navigate])

  function openLesson(lesson: LessonWithProgress) {
    navigate(`/treinamentos/${trainingId}/aula/${lesson.id}`)
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
              onClick={() => openLesson(nextLesson.lesson)}
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
          <div className="mb-8 bg-bg-card border border-red-veon/30 rounded-xl p-5 text-center">
            <CheckCircle className="w-8 h-8 text-red-veon mx-auto mb-2" />
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
              onSelectLesson={(lesson) => openLesson(lesson)}
            />
          ))}
        </div>
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
              className="bg-red-veon h-2 rounded-full transition-all"
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
      lesson.watched ? 'border-red-veon/30' : 'border-navy-800'
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
          <div className="absolute top-2 right-2 bg-red-veon rounded-full p-1">
            <CheckCircle className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start gap-2">
          <h3 className="text-sm font-medium text-text-primary line-clamp-2 mb-1 flex-1">{lesson.title}</h3>
        </div>
        {lesson.watched ? (
          <span className="text-xs text-red-veon">Concluída</span>
        ) : (
          lesson.description && <p className="text-xs text-text-muted line-clamp-2">{lesson.description}</p>
        )}
      </div>
    </div>
  )
}
