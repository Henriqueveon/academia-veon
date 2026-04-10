import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { BookOpen, ChevronRight, Lock, Users, PlayCircle } from 'lucide-react'

export function TrainingListPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  // RLS returns: trainings with access + trainings with visibility='vitrine'
  const { data: allTrainings = [], isLoading } = useQuery({
    queryKey: ['tripulante-trainings', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('trainings').select('*').order('sort_order')
      return data || []
    },
    enabled: !!user,
  })

  // Get user's groups and training_groups + direct access to determine actual access
  const { data: accessibleTrainingIds = new Set<string>() } = useQuery({
    queryKey: ['tripulante-access', user?.id],
    queryFn: async () => {
      const ids = new Set<string>()

      // Group-based access
      const { data: userGroups } = await supabase
        .from('user_groups')
        .select('group_id')
        .eq('user_id', user!.id)
      if (userGroups?.length) {
        const groupIds = userGroups.map((ug: any) => ug.group_id)
        const { data: tg } = await supabase
          .from('training_groups')
          .select('training_id')
          .in('group_id', groupIds)
        ;(tg || []).forEach((t: any) => ids.add(t.training_id))
      }

      // Direct access
      const { data: ut } = await supabase
        .from('user_trainings')
        .select('training_id')
        .eq('user_id', user!.id)
      ;(ut || []).forEach((t: any) => ids.add(t.training_id))

      return ids
    },
    enabled: !!user,
  })

  // Split into accessible and vitrine-only
  const trainings = allTrainings.filter((t: any) => accessibleTrainingIds.has(t.id))
  const vitrineTrainings = allTrainings.filter((t: any) => !accessibleTrainingIds.has(t.id) && t.visibility === 'vitrine')

  // Count lessons per training (for vitrine display)
  const { data: lessonCounts = {} } = useQuery({
    queryKey: ['training-lesson-counts'],
    queryFn: async () => {
      const { data: modules } = await supabase.from('modules').select('id, training_id')
      const { data: lessons } = await supabase.from('lessons').select('id, module_id')
      if (!modules || !lessons) return {}

      const result: Record<string, number> = {}
      for (const t of allTrainings) {
        const modIds = modules.filter((m: any) => m.training_id === t.id).map((m: any) => m.id)
        result[t.id] = lessons.filter((l: any) => modIds.includes(l.module_id)).length
      }
      return result
    },
    enabled: allTrainings.length > 0,
  })

  // Get progress per training (only for accessible)
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

  const progressValues = Object.values(progress as Record<string, { total: number; done: number }>)
  const totalLessons = progressValues.reduce((sum, p) => sum + p.total, 0)
  const totalDone = progressValues.reduce((sum, p) => sum + p.done, 0)
  const totalPending = totalLessons - totalDone

  return (
    <div>
      {profile && (
        <div className="bg-bg-card border border-navy-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold text-text-primary mb-1">
            Olá, {profile.name}!
          </h2>
          <p className="text-sm text-text-muted mb-4">Aqui está o resumo do seu progresso.</p>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm text-text-secondary">
                <span className="font-semibold text-text-primary">{totalDone}</span> aulas concluídas
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-navy-600" />
              <span className="text-sm text-text-secondary">
                <span className="font-semibold text-text-primary">{totalPending}</span> aulas pendentes
              </span>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold mb-8">Treinamentos</h1>

      {trainings.length === 0 && vitrineTrainings.length === 0 ? (
        <div className="text-center py-20 text-text-muted">
          <p className="text-lg">Nenhum treinamento disponível ainda.</p>
          <p className="text-sm mt-2">Aguarde a liberação do seu gestor.</p>
        </div>
      ) : (
        <>
          {/* Trainings with access */}
          {trainings.length > 0 && (
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

          {/* Vitrine trainings (locked) */}
          {vitrineTrainings.length > 0 && (
            <>
              <h2 className="text-xl font-bold mt-12 mb-6">Outros Treinamentos</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vitrineTrainings.map((t: any) => {
                  const lessonCount = (lessonCounts as any)[t.id] || 0
                  const studentCount = t.fake_students_count ?? null

                  return (
                    <div
                      key={t.id}
                      className="bg-bg-card border border-navy-800 rounded-xl overflow-hidden opacity-90"
                    >
                      {/* Thumbnail with lock overlay */}
                      <div className="relative">
                        {t.thumbnail_url ? (
                          <img src={t.thumbnail_url} alt={t.title} className="w-full h-44 object-cover" />
                        ) : (
                          <div className="w-full h-44 bg-navy-900 flex items-center justify-center">
                            <BookOpen className="w-14 h-14 text-navy-700" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <div className="bg-navy-900/80 rounded-full p-4">
                            <Lock className="w-8 h-8 text-text-muted" />
                          </div>
                        </div>
                      </div>

                      <div className="p-5">
                        <h3 className="font-semibold text-text-primary text-lg">{t.title}</h3>
                        {t.description && (
                          <p className="text-sm text-text-muted mt-1 line-clamp-3">{t.description}</p>
                        )}

                        {/* Stats */}
                        <div className="flex items-center gap-4 mt-4 text-xs text-text-muted">
                          {lessonCount > 0 && (
                            <span className="flex items-center gap-1">
                              <PlayCircle className="w-3.5 h-3.5" /> {lessonCount} aula{lessonCount !== 1 ? 's' : ''}
                            </span>
                          )}
                          {studentCount !== null && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" /> {studentCount} aluno{studentCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        <div className="mt-4 bg-navy-900/50 border border-navy-800 rounded-lg px-4 py-3 text-center">
                          <p className="text-xs text-text-muted">Você ainda não tem acesso a este treinamento.</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
