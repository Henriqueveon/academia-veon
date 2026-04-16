import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Shield } from 'lucide-react'

export function AccessPage() {
  const queryClient = useQueryClient()

  const { data: trainings = [] } = useQuery({
    queryKey: ['gestor-trainings'],
    queryFn: async () => {
      const { data } = await supabase.from('trainings').select('*').order('sort_order')
      return data || []
    },
  })

  const { data: groups = [] } = useQuery({
    queryKey: ['gestor-groups'],
    queryFn: async () => {
      const { data } = await supabase.from('groups').select('*').order('name')
      return data || []
    },
  })

  const { data: trainingGroups = [] } = useQuery({
    queryKey: ['gestor-training-groups'],
    queryFn: async () => {
      const { data } = await supabase.from('training_groups').select('*')
      return data || []
    },
  })

  const toggleAccess = useMutation({
    mutationFn: async ({ trainingId, groupId, grant }: { trainingId: string; groupId: string; grant: boolean }) => {
      if (grant) {
        await supabase.from('training_groups').insert({ training_id: trainingId, group_id: groupId })
      } else {
        await supabase.from('training_groups').delete().eq('training_id', trainingId).eq('group_id', groupId)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestor-training-groups'] })
    },
  })

  function hasAccess(trainingId: string, groupId: string) {
    return trainingGroups.some((tg: any) => tg.training_id === trainingId && tg.group_id === groupId)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Shield className="w-7 h-7 text-red-veon" />
          Liberações
        </h1>
        <p className="text-text-secondary mt-2">Defina quais turmas têm acesso a cada treinamento.</p>
      </div>

      {trainings.length === 0 || groups.length === 0 ? (
        <div className="text-center py-20 text-text-muted">
          <p>Crie treinamentos e turmas primeiro para configurar as liberações.</p>
        </div>
      ) : (
        <div className="bg-bg-card border border-navy-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-800">
                  <th className="text-left p-4 text-sm text-text-secondary font-medium">Treinamento</th>
                  {groups.map((g: any) => (
                    <th key={g.id} className="text-center p-4 text-sm text-text-secondary font-medium min-w-[120px]">
                      {g.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trainings.map((t: any) => (
                  <tr key={t.id} className="border-b border-navy-800/50 hover:bg-bg-card-hover">
                    <td className="p-4 text-sm font-medium text-text-primary">{t.title}</td>
                    {groups.map((g: any) => {
                      const granted = hasAccess(t.id, g.id)
                      return (
                        <td key={g.id} className="text-center p-4">
                          <button
                            onClick={() => toggleAccess.mutate({ trainingId: t.id, groupId: g.id, grant: !granted })}
                            className={`w-10 h-6 rounded-full transition-colors ${
                              granted ? 'bg-red-veon' : 'bg-navy-700'
                            } relative`}
                          >
                            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                              granted ? 'right-1' : 'left-1'
                            }`} />
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
