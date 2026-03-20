import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Play, CheckCircle, ChevronLeft, ChevronRight, X, ArrowLeft } from 'lucide-react'

interface LessonWithProgress {
  id: string
  module_id: string
  title: string
  description: string | null
  youtube_url: string
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
              onSelectLesson={setSelectedLesson}
              onMarkWatched={(id) => markWatched.mutate(id)}
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
  onMarkWatched,
}: {
  module: any
  onSelectLesson: (lesson: LessonWithProgress) => void
  onMarkWatched: (id: string) => void
}) {
  const scrollContainer = (id: string, direction: 'left' | 'right') => {
    const el = document.getElementById(id)
    if (el) el.scrollBy({ left: direction === 'left' ? -320 : 320, behavior: 'smooth' })
  }

  const completedCount = mod.lessons.filter((l: any) => l.watched).length

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-xl font-semibold text-text-primary">{mod.title}</h2>
        {mod.lessons.length > 0 && (
          <span className="text-xs text-text-muted bg-bg-card px-2 py-1 rounded">
            {completedCount}/{mod.lessons.length} concluídas
          </span>
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
              onMarkWatched={() => onMarkWatched(lesson.id)}
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
  onMarkWatched,
}: {
  lesson: LessonWithProgress
  onClick: () => void
  onMarkWatched: () => void
}) {
  const videoId = extractYoutubeId(lesson.youtube_url)
  const thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null

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
        {!lesson.watched && (
          <button
            onClick={(e) => { e.stopPropagation(); onMarkWatched() }}
            className="mt-3 text-xs text-text-muted hover:text-green-400 transition-colors flex items-center gap-1"
          >
            <CheckCircle className="w-4 h-4" /> Marcar como assistida
          </button>
        )}
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
  const videoId = extractYoutubeId(lesson.youtube_url)

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">{lesson.title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X className="w-6 h-6" />
          </button>
        </div>

        {videoId ? (
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              className="absolute inset-0 w-full h-full rounded-xl"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              title={lesson.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="bg-bg-card rounded-xl p-20 text-center text-text-muted">
            URL do vídeo inválida
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          {lesson.description && <p className="text-sm text-text-secondary">{lesson.description}</p>}
          {!lesson.watched && (
            <button
              onClick={() => onMarkWatched(lesson.id)}
              className="ml-auto flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              <CheckCircle className="w-4 h-4" /> Marcar como assistida
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
