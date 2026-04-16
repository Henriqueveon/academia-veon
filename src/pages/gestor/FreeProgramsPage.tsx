import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Plus, ChevronRight, Eye, EyeOff, PlayCircle } from 'lucide-react'

export function FreeProgramsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

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
                <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-red-veon transition-colors flex-shrink-0 mt-1" />
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
