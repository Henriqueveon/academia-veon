import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { BookOpen, ChevronRight } from 'lucide-react'

export function TrainingListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const { data: trainings = [], isLoading } = useQuery({
    queryKey: ['tripulante-trainings', user?.id],
    queryFn: async () => {
      // RLS already filters - only shows trainings the user has access to
      const { data } = await supabase.from('trainings').select('*').order('sort_order')
      return data || []
    },
    enabled: !!user,
  })

  // Get progress per training
  const { data: progress = {} } = useQuery({
    queryKey: ['tripulante-progress', user?.id],
    queryFn: async () => {
      const { data: modules } = await supabase.from('modules').select('id, training_id')
      const { data: lessons } = await supabase.from('lessons').select('id, module_id')
      const { data: watched } = await supabase
        .from('lesson_progress')
        .select('lesson_id')
        .eq('user_id', user!.id)
        .eq('watched', true)

      if (!modules || !lessons) return {}

      const watchedIds = new Set((watched || []).map((w: any) => w.lesson_id))
      const result: Record<string, { total: number; done: number }> = {}

      for (const t of trainings) {
        const modIds = modules.filter((m: any) => m.training_id === t.id).map((m: any) => m.id)
        const trainingLessons = lessons.filter((l: any) => modIds.includes(l.module_id))
        result[t.id] = {
          total: trainingLessons.length,
          done: trainingLessons.filter((l: any) => watchedIds.has(l.id)).length,
        }
      }
      return result
    },
    enabled: !!user && trainings.length > 0,
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

      {trainings.length === 0 ? (
        <div className="text-center py-20 text-text-muted">
          <p className="text-lg">Nenhum treinamento disponível ainda.</p>
          <p className="text-sm mt-2">Aguarde a liberação do seu gestor.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trainings.map((t: any) => {
            const p = (progress as any)[t.id] || { total: 0, done: 0 }
            const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0
            return (
              <div
                key={t.id}
                onClick={() => navigate(`/treinamentos/${t.id}`)}
                className="bg-bg-card border border-navy-800 rounded-xl overflow-hidden hover:border-navy-600 transition-colors cursor-pointer group"
              >
                {t.thumbnail_url ? (
                  <img src={t.thumbnail_url} alt={t.title} className="w-full h-44 object-cover" />
                ) : (
                  <div className="w-full h-44 bg-navy-900 flex items-center justify-center">
                    <BookOpen className="w-14 h-14 text-navy-700" />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-text-primary text-lg flex-1">{t.title}</h3>
                    <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-red-veon transition-colors flex-shrink-0 mt-1" />
                  </div>
                  {t.description && (
                    <p className="text-sm text-text-muted mt-1 line-clamp-2">{t.description}</p>
                  )}
                  {/* Progress bar */}
                  {p.total > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                        <span>{p.done}/{p.total} aulas</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="w-full bg-navy-800 rounded-full h-1.5">
                        <div
                          className="bg-red-veon h-1.5 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
