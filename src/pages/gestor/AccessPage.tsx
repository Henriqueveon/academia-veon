import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Shield } from 'lucide-react'

export function AccessPage() {
  const queryClient = useQueryClient()

  const { data: modules = [] } = useQuery({
    queryKey: ['gestor-modules'],
    queryFn: async () => {
      const { data } = await supabase.from('modules').select('*').order('sort_order')
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

  const { data: moduleGroups = [] } = useQuery({
    queryKey: ['gestor-module-groups'],
    queryFn: async () => {
      const { data } = await supabase.from('module_groups').select('*')
      return data || []
    },
  })

  const toggleAccess = useMutation({
    mutationFn: async ({ moduleId, groupId, grant }: { moduleId: string; groupId: string; grant: boolean }) => {
      if (grant) {
        await supabase.from('module_groups').insert({ module_id: moduleId, group_id: groupId })
      } else {
        await supabase.from('module_groups').delete().eq('module_id', moduleId).eq('group_id', groupId)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestor-module-groups'] })
    },
  })

  function hasAccess(moduleId: string, groupId: string) {
    return moduleGroups.some(mg => mg.module_id === moduleId && mg.group_id === groupId)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Shield className="w-7 h-7 text-red-veon" />
          Liberações
        </h1>
        <p className="text-text-secondary mt-2">Defina quais turmas têm acesso a cada módulo.</p>
      </div>

      {modules.length === 0 || groups.length === 0 ? (
        <div className="text-center py-20 text-text-muted">
          <p>Crie módulos e turmas primeiro para configurar as liberações.</p>
        </div>
      ) : (
        <div className="bg-bg-card border border-navy-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-800">
                  <th className="text-left p-4 text-sm text-text-secondary font-medium">Módulo</th>
                  {groups.map((g) => (
                    <th key={g.id} className="text-center p-4 text-sm text-text-secondary font-medium min-w-[120px]">
                      {g.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((mod) => (
                  <tr key={mod.id} className="border-b border-navy-800/50 hover:bg-bg-card-hover">
                    <td className="p-4 text-sm font-medium text-text-primary">{mod.title}</td>
                    {groups.map((g) => {
                      const granted = hasAccess(mod.id, g.id)
                      return (
                        <td key={g.id} className="text-center p-4">
                          <button
                            onClick={() => toggleAccess.mutate({ moduleId: mod.id, groupId: g.id, grant: !granted })}
                            className={`w-10 h-6 rounded-full transition-colors ${
                              granted ? 'bg-green-600' : 'bg-navy-700'
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
