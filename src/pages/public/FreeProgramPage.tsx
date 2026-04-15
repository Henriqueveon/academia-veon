import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { FreeProgramView, type FreeProgram, type FreeLesson } from '../../components/free/FreeProgramView'
import { LeadFormModal } from '../../components/free/LeadFormModal'

export function FreeProgramPage() {
  const { slug } = useParams<{ slug: string }>()
  const [unlocked, setUnlocked] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (!slug) return
    setUnlocked(localStorage.getItem('unlocked_' + slug) === 'true')
  }, [slug])

  const { data: program, isLoading } = useQuery({
    queryKey: ['free-program', slug],
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
    queryKey: ['free-program-lessons', program?.id],
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
      <div className="min-h-screen bg-[#0A1733] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#F26F2E] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!program) {
    return (
      <div className="min-h-screen bg-[#0A1733] flex flex-col items-center justify-center text-white px-6 text-center">
        <h1 className="text-2xl font-bold">Programa não encontrado</h1>
        <p className="text-[#B8C0D0] mt-2">O link pode ter expirado ou o programa não está publicado.</p>
      </div>
    )
  }

  const handleUnlock = () => {
    if (!slug) return
    localStorage.setItem('unlocked_' + slug, 'true')
    setUnlocked(true)
    setModalOpen(false)
  }

  return (
    <>
      <FreeProgramView
        program={program}
        lessons={lessons}
        unlocked={unlocked}
        onRequestUnlock={() => setModalOpen(true)}
      />
      <LeadFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleUnlock}
        webhookUrl={program.webhook_url}
        programSlug={program.slug}
        programTitle={program.title}
      />
    </>
  )
}
