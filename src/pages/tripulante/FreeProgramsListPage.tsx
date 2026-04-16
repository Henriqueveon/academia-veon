import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PlayCircle } from 'lucide-react'

export function FreeProgramsListPage() {
  const navigate = useNavigate()

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ['tripulante-free-programs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('free_programs')
        .select('*')
        .eq('published', true)
        .eq('visible_to_students', true)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
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
      <h1 className="text-2xl font-bold mb-6">Programas Educacionais Gratuitos</h1>

      {programs.length === 0 ? (
        <p className="text-center text-text-muted py-20">Nenhum programa disponível no momento.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {programs.map((p: any) => (
            <div
              key={p.id}
              onClick={() => navigate(`/programas-gratuitos/${p.slug}`)}
              className="bg-bg-card border border-navy-800 rounded-xl overflow-hidden hover:border-red-veon cursor-pointer transition-colors group"
            >
              <div className="w-full aspect-video bg-navy-900 flex items-center justify-center relative overflow-hidden">
                {(p.thumbnail_url || p.partner1_photo_url) ? (
                  <img src={p.thumbnail_url || p.partner1_photo_url} alt={p.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                ) : (
                  <PlayCircle className="w-14 h-14 text-navy-700" />
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-text-primary text-lg line-clamp-2">{p.title}</h3>
                {p.subtitle && (
                  <p className="text-sm text-text-muted mt-1 line-clamp-2">{p.subtitle}</p>
                )}
                {p.episodes_badge && (
                  <span className="inline-block mt-3 text-xs bg-red-veon/20 text-red-veon px-2 py-0.5 rounded-full">
                    {p.episodes_badge}
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
