import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Users, BookOpen, Layers, PlayCircle, CheckCircle, Flame, Thermometer, Snowflake, Moon, UserX, TrendingUp, UserPlus, Radio, X, Phone, Copy, Check, Shield } from 'lucide-react'

type Period = 'day' | 'week' | 'month'
type Segment = 'hot' | 'warm' | 'cold' | 'inactive' | 'never'

interface StudentWithActivity {
  id: string
  name: string
  whatsapp: string | null
  lastActivity: Date | null
  days: number | null
  segment: Segment
  groupNames: string[]
  trainingNames: string[]
}

export function DashboardPage() {
  const [newUsersPeriod, setNewUsersPeriod] = useState<Period>('week')
  const [activeSegment, setActiveSegment] = useState<Segment | null>(null)
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null)

  // Fetch all data
  const { data: profiles = [] } = useQuery({
    queryKey: ['dash-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, name, role, whatsapp, created_at')
      return data || []
    },
  })

  const { data: trainings = [] } = useQuery({
    queryKey: ['dash-trainings'],
    queryFn: async () => {
      const { data } = await supabase.from('trainings').select('id, title')
      return data || []
    },
  })

  const { data: groups = [] } = useQuery({
    queryKey: ['dash-groups'],
    queryFn: async () => {
      const { data } = await supabase.from('groups').select('id, name')
      return data || []
    },
  })

  const { data: userGroups = [] } = useQuery({
    queryKey: ['dash-user-groups'],
    queryFn: async () => {
      const { data } = await supabase.from('user_groups').select('user_id, group_id')
      return data || []
    },
  })

  const { data: trainingGroups = [] } = useQuery({
    queryKey: ['dash-training-groups'],
    queryFn: async () => {
      const { data } = await supabase.from('training_groups').select('training_id, group_id')
      return data || []
    },
  })

  const { data: userTrainings = [] } = useQuery({
    queryKey: ['dash-user-trainings'],
    queryFn: async () => {
      const { data } = await supabase.from('user_trainings').select('user_id, training_id')
      return data || []
    },
  })

  const { data: modules = [] } = useQuery({
    queryKey: ['dash-modules'],
    queryFn: async () => {
      const { data } = await supabase.from('modules').select('id')
      return data || []
    },
  })

  const { data: lessons = [] } = useQuery({
    queryKey: ['dash-lessons'],
    queryFn: async () => {
      const { data } = await supabase.from('lessons').select('id')
      return data || []
    },
  })

  const { data: lessonProgress = [] } = useQuery({
    queryKey: ['dash-lesson-progress'],
    queryFn: async () => {
      const { data } = await supabase.from('lesson_progress').select('user_id, lesson_id, watched, watched_at').eq('watched', true)
      return data || []
    },
  })

  const { data: lessonViews = [] } = useQuery({
    queryKey: ['dash-lesson-views'],
    queryFn: async () => {
      const { data } = await supabase.from('lesson_views').select('user_id, viewed_at')
      return data || []
    },
  })

  // Online students (activity in last 15 minutes, refreshes every 30s)
  const { data: onlineCount = 0 } = useQuery({
    queryKey: ['dash-online'],
    queryFn: async () => {
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('lesson_views')
        .select('user_id')
        .gte('viewed_at', fifteenMinAgo)
      if (!data) return 0
      return new Set(data.map((v: any) => v.user_id)).size
    },
    refetchInterval: 30000,
  })

  // Fetch users with email
  const { data: usersWithEmail = [] } = useQuery({
    queryKey: ['dash-users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_users')
      if (error) return []
      return data || []
    },
  })

  // Calculations — use RPC data as primary source (bypasses RLS), fallback to profiles
  const allUsers = usersWithEmail.length > 0 ? usersWithEmail : profiles
  const students = allUsers.filter((p: any) => p.role === 'tripulante')
  const totalStudents = students.length
  const totalTrainings = trainings.length
  const totalModules = modules.length
  const totalLessons = lessons.length
  const totalCompleted = lessonProgress.length

  // Completion rate
  const totalPossible = totalStudents * totalLessons
  const completionRate = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0

  // New students by period
  const now = new Date()
  function getNewStudents(period: Period) {
    const cutoff = new Date()
    if (period === 'day') cutoff.setHours(0, 0, 0, 0)
    else if (period === 'week') cutoff.setDate(cutoff.getDate() - 7)
    else cutoff.setMonth(cutoff.getMonth() - 1)
    return students.filter((s: any) => new Date(s.created_at) >= cutoff).length
  }

  // Engagement segments with student data
  function getLastActivity(userId: string): Date | null {
    const viewDates = lessonViews
      .filter((v: any) => v.user_id === userId)
      .map((v: any) => new Date(v.viewed_at))
    const progressDates = lessonProgress
      .filter((p: any) => p.user_id === userId && p.watched_at)
      .map((p: any) => new Date(p.watched_at))
    const all = [...viewDates, ...progressDates]
    if (all.length === 0) return null
    return new Date(Math.max(...all.map(d => d.getTime())))
  }

  function daysSince(date: Date | null): number | null {
    if (!date) return null
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  }

  function getSegment(days: number | null): Segment {
    if (days === null) return 'never'
    if (days <= 12) return 'hot'
    if (days <= 30) return 'warm'
    if (days <= 60) return 'cold'
    return 'inactive'
  }

  function getUserTrainingNames(userId: string): string[] {
    const ids = new Set<string>()
    // Direct
    userTrainings.filter((ut: any) => ut.user_id === userId).forEach((ut: any) => ids.add(ut.training_id))
    // Via groups
    const gIds = userGroups.filter((ug: any) => ug.user_id === userId).map((ug: any) => ug.group_id)
    trainingGroups.filter((tg: any) => gIds.includes(tg.group_id)).forEach((tg: any) => ids.add(tg.training_id))
    return trainings.filter((t: any) => ids.has(t.id)).map((t: any) => t.title)
  }

  function getUserGroupNames(userId: string): string[] {
    const gIds = userGroups.filter((ug: any) => ug.user_id === userId).map((ug: any) => ug.group_id)
    return groups.filter((g: any) => gIds.includes(g.id)).map((g: any) => g.name)
  }

  const studentsWithActivity: StudentWithActivity[] = students.map((s: any) => {
    const userRpc = usersWithEmail.find((u: any) => u.id === s.id)
    const lastActivity = getLastActivity(s.id)
    const days = daysSince(lastActivity)
    return {
      id: s.id,
      name: userRpc?.name || s.name || '—',
      whatsapp: userRpc?.whatsapp || s.whatsapp || null,
      lastActivity,
      days,
      segment: getSegment(days),
      groupNames: getUserGroupNames(s.id),
      trainingNames: getUserTrainingNames(s.id),
    }
  })

  const hot = studentsWithActivity.filter(s => s.segment === 'hot').length
  const warm = studentsWithActivity.filter(s => s.segment === 'warm').length
  const cold = studentsWithActivity.filter(s => s.segment === 'cold').length
  const inactive = studentsWithActivity.filter(s => s.segment === 'inactive').length
  const never = studentsWithActivity.filter(s => s.segment === 'never').length

  const segmentStudents = activeSegment
    ? studentsWithActivity.filter(s => s.segment === activeSegment)
    : []

  const segmentLabels: Record<Segment, { title: string; color: string }> = {
    hot: { title: 'Alunos Quentes', color: 'text-green-400' },
    warm: { title: 'Alunos Mornos', color: 'text-yellow-400' },
    cold: { title: 'Alunos Frios', color: 'text-orange-400' },
    inactive: { title: 'Alunos Inativos', color: 'text-red-400' },
    never: { title: 'Nunca Acessaram', color: 'text-text-muted' },
  }

  const periodLabels: Record<Period, string> = { day: 'Hoje', week: 'Semana', month: 'Mês' }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">Dashboard</h1>

      {/* Online now */}
      <div className="bg-bg-card border border-green-800/50 rounded-xl p-5 mb-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-green-600/20 flex items-center justify-center relative">
          <Radio className="w-6 h-6 text-green-400" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
        </div>
        <div>
          <p className="text-sm text-text-muted">Alunos online agora</p>
          <p className="text-3xl font-bold text-green-400">{onlineCount}</p>
        </div>
        <p className="text-xs text-text-muted ml-auto">Atividade nos últimos 15 min</p>
      </div>

      {/* Row 1: Main stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Users} label="Total de Alunos" value={totalStudents} color="text-blue-400" />
        <StatCard icon={BookOpen} label="Treinamentos" value={totalTrainings} color="text-purple-400" />
        <StatCard icon={Layers} label="Módulos" value={totalModules} color="text-cyan-400" />
        <StatCard icon={PlayCircle} label="Aulas" value={totalLessons} color="text-pink-400" />
      </div>

      {/* Row 2: Completion + New students */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Completed lessons */}
        <div className="bg-bg-card border border-navy-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-text-muted">Aulas Concluídas</p>
              <p className="text-2xl font-bold text-text-primary">{totalCompleted}</p>
            </div>
          </div>
        </div>

        {/* Completion rate */}
        <div className="bg-bg-card border border-navy-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-600/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-text-muted">Taxa de Conclusão</p>
              <p className="text-2xl font-bold text-text-primary">{completionRate}%</p>
            </div>
          </div>
          <div className="w-full bg-navy-800 rounded-full h-2">
            <div className="bg-yellow-500 h-2 rounded-full transition-all" style={{ width: `${completionRate}%` }} />
          </div>
        </div>

        {/* New students */}
        <div className="bg-bg-card border border-navy-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-text-muted">Novos Alunos</p>
              <p className="text-2xl font-bold text-text-primary">{getNewStudents(newUsersPeriod)}</p>
            </div>
          </div>
          <div className="flex gap-1">
            {(['day', 'week', 'month'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setNewUsersPeriod(p)}
                className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                  newUsersPeriod === p
                    ? 'bg-blue-600 text-white'
                    : 'bg-navy-800 text-text-muted hover:text-text-primary'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Engagement segments */}
      <h2 className="text-lg font-semibold mb-4">Engajamento dos Alunos</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <EngagementCard icon={Flame} label="Quentes" sublabel="Até 12 dias" value={hot} total={totalStudents} color="bg-green-600/20" textColor="text-green-400" borderColor="border-green-800/50" onClick={() => setActiveSegment('hot')} />
        <EngagementCard icon={Thermometer} label="Mornos" sublabel="13 a 30 dias" value={warm} total={totalStudents} color="bg-yellow-600/20" textColor="text-yellow-400" borderColor="border-yellow-800/50" onClick={() => setActiveSegment('warm')} />
        <EngagementCard icon={Snowflake} label="Frios" sublabel="31 a 60 dias" value={cold} total={totalStudents} color="bg-orange-600/20" textColor="text-orange-400" borderColor="border-orange-800/50" onClick={() => setActiveSegment('cold')} />
        <EngagementCard icon={Moon} label="Inativos" sublabel="+60 dias" value={inactive} total={totalStudents} color="bg-red-600/20" textColor="text-red-400" borderColor="border-red-800/50" onClick={() => setActiveSegment('inactive')} />
        <EngagementCard icon={UserX} label="Nunca acessou" sublabel="0 aulas" value={never} total={totalStudents} color="bg-navy-700/50" textColor="text-text-muted" borderColor="border-navy-700" onClick={() => setActiveSegment('never')} />
      </div>

      {/* Segment modal */}
      {activeSegment && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setActiveSegment(null)}>
          <div className="bg-bg-card border border-navy-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-navy-800">
              <h2 className={`text-lg font-semibold ${segmentLabels[activeSegment].color}`}>
                {segmentLabels[activeSegment].title}
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-muted">{segmentStudents.length} aluno(s)</span>
                <button onClick={() => setActiveSegment(null)} className="text-text-muted hover:text-text-primary"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-3">
              {segmentStudents.length === 0 ? (
                <p className="text-center text-text-muted py-8">Nenhum aluno nesta categoria.</p>
              ) : (
                <div className="space-y-2">
                  {segmentStudents
                    .sort((a, b) => (a.days ?? 999) - (b.days ?? 999))
                    .map((s) => {
                    const formattedPhone = s.whatsapp
                      ? s.whatsapp.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
                      : null
                    const lastDate = s.lastActivity
                      ? s.lastActivity.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : null

                    return (
                      <div key={s.id} className="bg-bg-secondary border border-navy-800 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-navy-900 rounded-full flex items-center justify-center text-sm font-bold text-text-primary flex-shrink-0">
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary">{s.name}</p>
                            {formattedPhone ? (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Phone className="w-3 h-3 text-text-muted flex-shrink-0" />
                                <span className="text-xs text-text-muted">{formattedPhone}</span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(s.whatsapp!)
                                    setCopiedPhone(s.id)
                                    setTimeout(() => setCopiedPhone(null), 2000)
                                  }}
                                  className="text-text-muted hover:text-text-primary"
                                >
                                  {copiedPhone === s.id
                                    ? <Check className="w-3 h-3 text-green-400" />
                                    : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            ) : (
                              <p className="text-xs text-text-muted mt-0.5">Sem WhatsApp</p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            {lastDate ? (
                              <p className="text-xs text-text-muted">{lastDate}</p>
                            ) : (
                              <p className="text-xs text-text-muted">Nunca acessou</p>
                            )}
                          </div>
                        </div>

                        {/* Turmas e Treinamentos */}
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                          {s.groupNames.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <Shield className="w-3 h-3 text-text-muted flex-shrink-0" />
                              {s.groupNames.map((name) => (
                                <span key={name} className="text-xs bg-navy-800 text-text-muted px-1.5 py-0.5 rounded">{name}</span>
                              ))}
                            </div>
                          )}
                          {s.trainingNames.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <BookOpen className="w-3 h-3 text-text-muted flex-shrink-0" />
                              {s.trainingNames.map((name) => (
                                <span key={name} className="text-xs bg-blue-900/30 text-blue-400 border border-blue-800/50 px-1.5 py-0.5 rounded">{name}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="bg-bg-card border border-navy-800 rounded-xl p-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-navy-900 flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div>
          <p className="text-xs text-text-muted">{label}</p>
          <p className="text-2xl font-bold text-text-primary">{value}</p>
        </div>
      </div>
    </div>
  )
}

function EngagementCard({
  icon: Icon, label, sublabel, value, total, color, textColor, borderColor, onClick,
}: {
  icon: any; label: string; sublabel: string; value: number; total: number
  color: string; textColor: string; borderColor: string; onClick: () => void
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className={`bg-bg-card border ${borderColor} rounded-xl p-5 cursor-pointer hover:brightness-110 transition-all`} onClick={onClick}>
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center mb-3`}>
        <Icon className={`w-5 h-5 ${textColor}`} />
      </div>
      <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
      <p className="text-sm text-text-primary mt-1">{label}</p>
      <p className="text-xs text-text-muted">{sublabel}</p>
      <div className="w-full bg-navy-800 rounded-full h-1.5 mt-3">
        <div className={`h-1.5 rounded-full transition-all ${textColor.replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-text-muted mt-1">{pct}% dos alunos</p>
    </div>
  )
}
