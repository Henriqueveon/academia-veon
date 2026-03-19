import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Play, CheckCircle, ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { Module, Lesson } from '../../types/database'

interface ModuleWithLessons extends Module {
  lessons: (Lesson & { watched?: boolean })[]
}

function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/)
  return match ? match[1] : null
}

export function TrainingPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [selectedLesson, setSelectedLesson] = useState<(Lesson & { watched?: boolean }) | null>(null)

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ['training-modules', user?.id],
    queryFn: async () => {
      // Get user's groups
      const { data: userGroups } = await supabase
        .from('user_groups')
        .select('group_id')
        .eq('user_id', user!.id)

      if (!userGroups?.length) return []

      const groupIds = userGroups.map(ug => ug.group_id)

      // Get modules accessible to user's groups
      const { data: moduleGroups } = await supabase
        .from('module_groups')
        .select('module_id')
        .in('group_id', groupIds)

      if (!moduleGroups?.length) return []

      const moduleIds = [...new Set(moduleGroups.map(mg => mg.module_id))]

      // Get modules with lessons
      const { data: modulesData } = await supabase
        .from('modules')
        .select('*')
        .in('id', moduleIds)
        .order('sort_order')

      if (!modulesData?.length) return []

      // Get all lessons for these modules
      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('*')
        .in('module_id', moduleIds)
        .order('sort_order')

      // Get progress
      const { data: progressData } = await supabase
        .from('lesson_progress')
        .select('lesson_id, watched')
        .eq('user_id', user!.id)

      const progressMap = new Map(progressData?.map(p => [p.lesson_id, p.watched]) || [])

      return modulesData.map(mod => ({
        ...mod,
        lessons: (lessonsData || [])
          .filter(l => l.module_id === mod.id)
          .map(l => ({ ...l, watched: progressMap.get(l.id) || false }))
      })) as ModuleWithLessons[]
    },
    enabled: !!user,
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
      <h1 className="text-2xl font-bold mb-8">Treinamentos</h1>

      {modules.length === 0 ? (
        <div className="text-center py-20 text-text-muted">
          <p className="text-lg">Nenhum treinamento disponível ainda.</p>
          <p className="text-sm mt-2">Aguarde a liberação do seu gestor.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {modules.map((mod) => (
            <ModuleRow
              key={mod.id}
              module={mod}
              onSelectLesson={setSelectedLesson}
              onMarkWatched={(id) => markWatched.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Video modal */}
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
  module: ModuleWithLessons
  onSelectLesson: (lesson: Lesson & { watched?: boolean }) => void
  onMarkWatched: (id: string) => void
}) {
  const scrollContainer = (id: string, direction: 'left' | 'right') => {
    const el = document.getElementById(id)
    if (el) {
      const scrollAmount = 320
      el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' })
    }
  }

  const completedCount = mod.lessons.filter(l => l.watched).length
  const totalCount = mod.lessons.length

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-xl font-semibold text-text-primary">{mod.title}</h2>
        {totalCount > 0 && (
          <span className="text-xs text-text-muted bg-bg-card px-2 py-1 rounded">
            {completedCount}/{totalCount} concluídas
          </span>
        )}
      </div>
      {mod.description && (
        <p className="text-sm text-text-secondary mb-4">{mod.description}</p>
      )}

      <div className="relative group">
        {/* Scroll buttons */}
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
          className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide"
          style={{ scrollbarWidth: 'none' }}
        >
          {mod.lessons.map((lesson) => (
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
  lesson: Lesson & { watched?: boolean }
  onClick: () => void
  onMarkWatched: () => void
}) {
  const videoId = extractYoutubeId(lesson.youtube_url)
  const thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null

  return (
    <div className="flex-shrink-0 w-72 bg-bg-card border border-navy-800 rounded-xl overflow-hidden hover:border-navy-600 transition-colors group/card">
      {/* Thumbnail */}
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

      {/* Info */}
      <div className="p-4">
        <h3 className="text-sm font-medium text-text-primary line-clamp-2 mb-1">{lesson.title}</h3>
        {lesson.description && (
          <p className="text-xs text-text-muted line-clamp-2">{lesson.description}</p>
        )}
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
  lesson: Lesson & { watched?: boolean }
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
          {lesson.description && (
            <p className="text-sm text-text-secondary">{lesson.description}</p>
          )}
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
