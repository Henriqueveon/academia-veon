import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Plus, ChevronRight, Eye, EyeOff, PlayCircle, Copy, X, FileText, Layers, Loader2 } from 'lucide-react'

export function FreeProgramsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [duplicateTarget, setDuplicateTarget] = useState<{ id: string; title: string; lessons: number } | null>(null)

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ['gestor-free-programs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('free_programs')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  const { data: lessons = [] } = useQuery({
    queryKey: ['gestor-free-programs-lessons-count'],
    queryFn: async () => {
      const { data } = await supabase.from('free_program_lessons').select('id, program_id')
      return data || []
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const slug = 'novo-' + Date.now()
      const { data, error } = await supabase
        .from('free_programs')
        .insert({ title: 'Novo programa', slug })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ['gestor-free-programs'] })
      if (row?.id) navigate(`/gestor/programas/${row.id}`)
    },
  })

  const duplicateMutation = useMutation({
    mutationFn: async ({ programId, includeLessons }: { programId: string; includeLessons: boolean }) => {
      const { data: original, error: fetchErr } = await supabase
        .from('free_programs')
        .select('*')
        .eq('id', programId)
        .single()
      if (fetchErr) throw fetchErr
      if (!original) throw new Error('Programa não encontrado')

      const { id: _oldId, created_at: _c, updated_at: _u, slug: oldSlug, title: oldTitle, ...rest } = original as any
      const newProgram = {
        ...rest,
        slug: `${oldSlug}-copia-${Date.now()}`,
        title: `${oldTitle} (Cópia)`,
        published: false,
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('free_programs')
        .insert(newProgram)
        .select()
        .single()
      if (insertErr) throw insertErr

      if (includeLessons) {
        const { data: originalLessons, error: lessonsErr } = await supabase
          .from('free_program_lessons')
          .select('*')
          .eq('program_id', programId)
        if (lessonsErr) throw lessonsErr

        if (originalLessons && originalLessons.length > 0) {
          const newLessons = originalLessons.map((l: any) => {
            const { id: _lid, created_at: _lc, program_id: _pid, ...lrest } = l
            return { ...lrest, program_id: inserted.id }
          })
          const { error: insLessonsErr } = await supabase.from('free_program_lessons').insert(newLessons)
          if (insLessonsErr) throw insLessonsErr
        }
      }

      return inserted
    },
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ['gestor-free-programs'] })
      queryClient.invalidateQueries({ queryKey: ['gestor-free-programs-lessons-count'] })
      setDuplicateTarget(null)
      if (row?.id) navigate(`/gestor/programas/${row.id}`)
    },
  })

  function lessonCount(programId: string) {
    return lessons.filter((l: any) => l.program_id === programId).length
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
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Programas Educacionais Gratuitos</h1>
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="flex items-center gap-2 bg-red-veon hover:bg-red-veon-dark text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Novo programa
        </button>
      </div>

      {duplicateTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => !duplicateMutation.isPending && setDuplicateTarget(null)}
        >
          <div
            className="bg-bg-card border border-navy-800 rounded-xl max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-5 border-b border-navy-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-veon/10 flex items-center justify-center">
                  <Copy className="w-5 h-5 text-red-veon" />
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary">Duplicar programa</h3>
                  <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{duplicateTarget.title}</p>
                </div>
              </div>
              <button
                onClick={() => !duplicateMutation.isPending && setDuplicateTarget(null)}
                disabled={duplicateMutation.isPending}
                className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-navy-800 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-sm text-text-muted">Escolha como deseja duplicar este programa:</p>

              <button
                onClick={() => duplicateMutation.mutate({ programId: duplicateTarget.id, includeLessons: true })}
                disabled={duplicateMutation.isPending}
                className="w-full flex items-start gap-3 p-4 rounded-lg border border-navy-800 hover:border-red-veon hover:bg-navy-800/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Layers className="w-5 h-5 text-red-veon flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-text-primary">Duplicar COM as aulas</div>
                  <div className="text-xs text-text-muted mt-1">
                    Copia o programa e todas as {duplicateTarget.lessons} aula(s) vinculadas.
                  </div>
                </div>
              </button>

              <button
                onClick={() => duplicateMutation.mutate({ programId: duplicateTarget.id, includeLessons: false })}
                disabled={duplicateMutation.isPending}
                className="w-full flex items-start gap-3 p-4 rounded-lg border border-navy-800 hover:border-red-veon hover:bg-navy-800/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="w-5 h-5 text-red-veon flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-text-primary">Duplicar SEM as aulas</div>
                  <div className="text-xs text-text-muted mt-1">
                    Copia apenas o programa. Evita referências duplicadas no R2.
                  </div>
                </div>
              </button>

              {duplicateMutation.isPending && (
                <div className="flex items-center justify-center gap-2 text-sm text-text-muted pt-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Duplicando...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {programs.length === 0 ? (
        <p className="text-center text-text-muted py-20">Nenhum programa criado ainda.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {programs.map((p: any) => (
            <div
              key={p.id}
              onClick={() => navigate(`/gestor/programas/${p.id}`)}
              className="bg-bg-card border border-navy-800 rounded-xl p-5 hover:border-navy-600 transition-colors group cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-text-muted text-xs">
                    <PlayCircle className="w-3.5 h-3.5" />
                    <span className="font-mono truncate">/programas/{p.slug}</span>
                  </div>
                  <h3 className="font-semibold text-text-primary text-lg mt-2 truncate">{p.title}</h3>
                  {p.subtitle && (
                    <p className="text-sm text-text-muted mt-1 line-clamp-2">{p.subtitle}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 mt-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (duplicateMutation.isPending) return
                      setDuplicateTarget({ id: p.id, title: p.title, lessons: lessonCount(p.id) })
                    }}
                    disabled={duplicateMutation.isPending}
                    title="Duplicar programa"
                    className="p-1.5 rounded-md text-text-muted hover:text-red-veon hover:bg-navy-800 transition-colors disabled:opacity-50"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-red-veon transition-colors" />
                </div>
              </div>

              <div className="flex items-center gap-4 mt-4 text-xs text-text-muted">
                <span>{lessonCount(p.id)} aula(s)</span>
                <span className={`flex items-center gap-1 ${p.published ? 'text-red-veon' : 'text-text-muted'}`}>
                  {p.published ? <><Eye className="w-3 h-3" /> Publicado</> : <><EyeOff className="w-3 h-3" /> Rascunho</>}
                </span>
                {p.visible_to_students === false && (
                  <span className="flex items-center gap-1 text-orange-400">
                    <EyeOff className="w-3 h-3" /> Oculto p/ alunos
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
