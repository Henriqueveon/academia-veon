import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { BarChart3, Eye, Users, TrendingUp } from 'lucide-react'

export function EngagementPage() {
  const [selectedTrainingId, setSelectedTrainingId] = useState<string | null>(null)

  const { data: trainings = [] } = useQuery({
    queryKey: ['gestor-trainings'],
    queryFn: async () => {
      const { data } = await supabase.from('trainings').select('*').order('sort_order')
      return data || []
    },
  })

  const { data: modules = [] } = useQuery({
    queryKey: ['engagement-modules', selectedTrainingId],
    queryFn: async () => {
      const { data } = await supabase
        .from('modules')
        .select('*')
        .eq('training_id', selectedTrainingId!)
        .order('sort_order')
      return data || []
    },
    enabled: !!selectedTrainingId,
  })

  const moduleIds = useMemo(() => modules.map((m: any) => m.id), [modules])

  const { data: lessons = [] } = useQuery({
    queryKey: ['engagement-lessons', moduleIds],
    queryFn: async () => {
      if (!moduleIds.length) return []
      const { data } = await supabase
        .from('lessons')
        .select('*')
        .in('module_id', moduleIds)
        .order('sort_order')
      return data || []
    },
    enabled: moduleIds.length > 0,
  })

  const lessonIds = useMemo(() => lessons.map((l: any) => l.id), [lessons])

  const { data: lessonViews = [] } = useQuery({
    queryKey: ['engagement-views', lessonIds],
    queryFn: async () => {
      if (!lessonIds.length) return []
      const { data } = await supabase
        .from('lesson_views')
        .select('*')
        .in('lesson_id', lessonIds)
      return data || []
    },
    enabled: lessonIds.length > 0,
  })

  const { data: lessonProgress = [] } = useQuery({
    queryKey: ['engagement-progress', lessonIds],
    queryFn: async () => {
      if (!lessonIds.length) return []
      const { data } = await supabase
        .from('lesson_progress')
        .select('*')
        .in('lesson_id', lessonIds)
        .eq('watched', true)
      return data || []
    },
    enabled: lessonIds.length > 0,
  })

  const userIdsFromViews = useMemo(() => {
    const ids = new Set<string>()
    lessonViews.forEach((v: any) => ids.add(v.user_id))
    lessonProgress.forEach((p: any) => ids.add(p.user_id))
    return Array.from(ids)
  }, [lessonViews, lessonProgress])

  const { data: profiles = [] } = useQuery({
    queryKey: ['engagement-profiles', userIdsFromViews],
    queryFn: async () => {
      if (!userIdsFromViews.length) return []
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIdsFromViews)
      return data || []
    },
    enabled: userIdsFromViews.length > 0,
  })

  const { data: groups = [] } = useQuery({
    queryKey: ['gestor-groups'],
    queryFn: async () => {
      const { data } = await supabase.from('groups').select('*').order('name')
      return data || []
    },
  })

  const { data: userGroups = [] } = useQuery({
    queryKey: ['gestor-user-groups'],
    queryFn: async () => {
      const { data } = await supabase.from('user_groups').select('*')
      return data || []
    },
  })

  const groupMap = useMemo(() => {
    const map = new Map<string, string[]>()
    userGroups.forEach((ug: any) => {
      const existing = map.get(ug.user_id) || []
      const group = groups.find((g: any) => g.id === ug.group_id)
      if (group) existing.push((group as any).name)
      map.set(ug.user_id, existing)
    })
    return map
  }, [userGroups, groups])

  const aggregated = useMemo(() => {
    if (!selectedTrainingId || !lessonIds.length) return []

    const totalLessons = lessonIds.length

    // Views per user (unique lesson count) — from lesson_views
    const viewsByUser = new Map<string, Set<string>>()
    const lastActivityByUser = new Map<string, string>()
    lessonViews.forEach((v: any) => {
      if (!viewsByUser.has(v.user_id)) viewsByUser.set(v.user_id, new Set())
      viewsByUser.get(v.user_id)!.add(v.lesson_id)
      const prev = lastActivityByUser.get(v.user_id)
      if (!prev || v.viewed_at > prev) lastActivityByUser.set(v.user_id, v.viewed_at)
    })

    // Completed per user (unique lesson count) — also counts as "viewed"
    const completedByUser = new Map<string, Set<string>>()
    lessonProgress.forEach((p: any) => {
      if (!completedByUser.has(p.user_id)) completedByUser.set(p.user_id, new Set())
      completedByUser.get(p.user_id)!.add(p.lesson_id)
      // Completed lessons also count as viewed
      if (!viewsByUser.has(p.user_id)) viewsByUser.set(p.user_id, new Set())
      viewsByUser.get(p.user_id)!.add(p.lesson_id)
      // Use watched_at as last activity if no view exists or is more recent
      const prev = lastActivityByUser.get(p.user_id)
      if (p.watched_at && (!prev || p.watched_at > prev)) lastActivityByUser.set(p.user_id, p.watched_at)
    })

    return profiles.map((p: any) => {
      const viewed = viewsByUser.get(p.id)?.size || 0
      const completed = completedByUser.get(p.id)?.size || 0
      const lastActivity = lastActivityByUser.get(p.id) || null
      const turmas = groupMap.get(p.id) || []
      return {
        id: p.id,
        name: p.name,
        role: p.role,
        turmas,
        viewed,
        completed,
        totalLessons,
        progress: totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0,
        lastActivity,
      }
    }).sort((a: any, b: any) => b.progress - a.progress)
  }, [selectedTrainingId, lessonIds, lessonViews, lessonProgress, profiles, groupMap])

  const stats = useMemo(() => {
    const totalViews = lessonViews.length + lessonProgress.length
    const allUserIds = new Set([
      ...lessonViews.map((v: any) => v.user_id),
      ...lessonProgress.map((p: any) => p.user_id),
    ])
    const activeUsers = allUserIds.size
    const avgCompletion = aggregated.length > 0
      ? Math.round(aggregated.reduce((sum: number, u: any) => sum + u.progress, 0) / aggregated.length)
      : 0
    return { totalViews, activeUsers, avgCompletion }
  }, [lessonViews, aggregated])

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
      ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <BarChart3 className="w-7 h-7 text-red-veon" />
          Engajamento
        </h1>
        <p className="text-text-secondary mt-2">Acompanhe o progresso dos tripulantes em cada treinamento.</p>
      </div>

      {/* Training selector */}
      <div className="mb-6">
        <select
          value={selectedTrainingId || ''}
          onChange={(e) => setSelectedTrainingId(e.target.value || null)}
          className="bg-bg-card border border-navy-800 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon w-full max-w-md"
        >
          <option value="">Selecione um treinamento</option>
          {trainings.map((t: any) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
      </div>

      {!selectedTrainingId ? (
        <div className="text-center py-20 text-text-muted">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Selecione um treinamento para ver os dados de engajamento.</p>
        </div>
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-bg-card border border-navy-800 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <Eye className="w-5 h-5 text-blue-400" />
                <span className="text-sm text-text-secondary">Total de Visualizações</span>
              </div>
              <p className="text-3xl font-bold text-text-primary">{stats.totalViews}</p>
            </div>
            <div className="bg-bg-card border border-navy-800 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5 text-green-400" />
                <span className="text-sm text-text-secondary">Tripulantes Ativos</span>
              </div>
              <p className="text-3xl font-bold text-text-primary">{stats.activeUsers}</p>
            </div>
            <div className="bg-bg-card border border-navy-800 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-yellow-400" />
                <span className="text-sm text-text-secondary">Conclusão Média</span>
              </div>
              <p className="text-3xl font-bold text-text-primary">{stats.avgCompletion}%</p>
            </div>
          </div>

          {/* Table */}
          {aggregated.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <p>Nenhum tripulante acessou este treinamento ainda.</p>
            </div>
          ) : (
            <div className="bg-bg-card border border-navy-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-navy-800">
                      <th className="text-left p-4 text-sm text-text-secondary font-medium">Tripulante</th>
                      <th className="text-left p-4 text-sm text-text-secondary font-medium">Cargo</th>
                      <th className="text-left p-4 text-sm text-text-secondary font-medium">Turma(s)</th>
                      <th className="text-center p-4 text-sm text-text-secondary font-medium">Visualizadas</th>
                      <th className="text-center p-4 text-sm text-text-secondary font-medium">Concluídas</th>
                      <th className="text-left p-4 text-sm text-text-secondary font-medium min-w-[180px]">Progresso</th>
                      <th className="text-left p-4 text-sm text-text-secondary font-medium">Última Atividade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregated.map((row: any) => (
                      <tr key={row.id} className="border-b border-navy-800/50 hover:bg-navy-900/30 transition-colors">
                        <td className="p-4 text-sm font-medium text-text-primary">{row.name}</td>
                        <td className="p-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            row.role === 'gestor'
                              ? 'bg-red-veon/20 text-red-400'
                              : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {row.role}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {row.turmas.length > 0 ? row.turmas.map((t: string, i: number) => (
                              <span key={i} className="text-xs bg-navy-800 text-text-secondary px-2 py-0.5 rounded">
                                {t}
                              </span>
                            )) : (
                              <span className="text-xs text-text-muted">-</span>
                            )}
                          </div>
                        </td>
                        <td className="text-center p-4 text-sm text-text-secondary">
                          {row.viewed}/{row.totalLessons}
                        </td>
                        <td className="text-center p-4 text-sm text-text-secondary">
                          {row.completed}/{row.totalLessons}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-navy-900 rounded-full h-2">
                              <div
                                className="bg-green-500 h-2 rounded-full transition-all"
                                style={{ width: `${row.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-text-muted w-10 text-right">{row.progress}%</span>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-text-muted whitespace-nowrap">
                          {formatDate(row.lastActivity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
