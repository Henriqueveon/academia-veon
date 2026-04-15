import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { FreeProgramView, type FreeProgram, type FreeLesson } from '../../components/free/FreeProgramView'

export function FreeProgramWatchPage() {
  const { slug } = useParams<{ slug: string }>()

  const { data: program, isLoading } = useQuery({
    queryKey: ['tripulante-free-program', slug],
    queryFn: async () => {
      if (!slug) return null
      const { data, error } = await supabase
        .from('free_programs')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle()
      if (error) throw error
      return data as FreeProgram | null
    },
    enabled: !!slug,
  })

  const { data: lessons = [] } = useQuery({
    queryKey: ['tripulante-free-program-lessons', program?.id],
    queryFn: async () => {
      if (!program?.id) return []
      const { data, error } = await supabase
        .from('free_program_lessons')
        .select('*')
        .eq('program_id', program.id)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return (data || []) as FreeLesson[]
    },
    enabled: !!program?.id,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-red-veon border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!program) {
    return (
      <div className="py-20 text-center text-text-muted">Programa não encontrado.</div>
    )
  }

  // Tripulante já é membro: sempre desbloqueado, sem modal
  return (
    <div className="-m-4 md:-m-6">
      <FreeProgramView
        program={program}
        lessons={lessons}
        unlocked={true}
        onRequestUnlock={() => {}}
      />
    </div>
  )
}
