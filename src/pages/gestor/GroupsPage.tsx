import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, Users, UserPlus, X } from 'lucide-react'

export function GroupsPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [managingGroup, setManagingGroup] = useState<string | null>(null)

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['gestor-groups'],
    queryFn: async () => {
      const { data } = await supabase.from('groups').select('*').order('name')
      return data || []
    },
  })

  const { data: profiles = [] } = useQuery({
    queryKey: ['gestor-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').order('name')
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        await supabase.from('groups').update({ name }).eq('id', editing.id)
      } else {
        await supabase.from('groups').insert({ name })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestor-groups'] })
      setName('')
      setEditing(null)
      setShowForm(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('groups').delete().eq('id', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestor-groups'] })
    },
  })

  const toggleUserGroup = useMutation({
    mutationFn: async ({ userId, groupId, add }: { userId: string; groupId: string; add: boolean }) => {
      if (add) {
        await supabase.from('user_groups').insert({ user_id: userId, group_id: groupId })
      } else {
        await supabase.from('user_groups').delete().eq('user_id', userId).eq('group_id', groupId)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestor-user-groups'] })
    },
  })

  function getMembersOfGroup(groupId: string) {
    const memberIds = userGroups.filter(ug => ug.group_id === groupId).map(ug => ug.user_id)
    return profiles.filter(p => memberIds.includes(p.id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Turmas</h1>
        <button
          onClick={() => { setName(''); setEditing(null); setShowForm(true) }}
          className="flex items-center gap-2 bg-red-veon hover:bg-red-veon-dark text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Nova Turma
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-bg-card border border-navy-800 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">{editing ? 'Editar Turma' : 'Nova Turma'}</h2>
          <div className="flex gap-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
              placeholder="Nome da turma"
            />
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!name || saveMutation.isPending}
              className="bg-red-veon hover:bg-red-veon-dark text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              Salvar
            </button>
            <button onClick={() => setShowForm(false)} className="bg-bg-input text-text-secondary hover:text-text-primary px-6 py-2 rounded-lg transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Group list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-red-veon border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const members = getMembersOfGroup(g.id)
            const isManaging = managingGroup === g.id
            return (
              <div key={g.id} className="bg-bg-card border border-navy-800 rounded-xl p-4">
                <div className="flex items-center gap-4">
                  <Users className="w-5 h-5 text-navy-400" />
                  <div className="flex-1">
                    <h3 className="font-medium text-text-primary">{g.name}</h3>
                    <p className="text-xs text-text-muted">{members.length} membro(s)</p>
                  </div>
                  <button
                    onClick={() => setManagingGroup(isManaging ? null : g.id)}
                    className={`p-2 transition-colors ${isManaging ? 'text-red-veon' : 'text-text-muted hover:text-text-primary'}`}
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setName(g.name); setEditing(g); setShowForm(true) }} className="p-2 text-text-muted hover:text-text-primary transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Excluir turma ${g.name}?`)) deleteMutation.mutate(g.id) }}
                    className="p-2 text-text-muted hover:text-red-veon transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Member management */}
                {isManaging && (
                  <div className="mt-4 border-t border-navy-800 pt-4">
                    <p className="text-sm text-text-secondary mb-3">Gerenciar membros:</p>
                    <div className="space-y-2">
                      {profiles.map((p) => {
                        const isMember = userGroups.some(ug => ug.user_id === p.id && ug.group_id === g.id)
                        return (
                          <label key={p.id} className="flex items-center gap-3 cursor-pointer hover:bg-bg-card-hover p-2 rounded-lg">
                            <input
                              type="checkbox"
                              checked={isMember}
                              onChange={() => toggleUserGroup.mutate({ userId: p.id, groupId: g.id, add: !isMember })}
                              className="w-4 h-4 rounded accent-red-veon"
                            />
                            <span className="text-sm text-text-primary">{p.name}</span>
                            <span className="text-xs text-text-muted capitalize">({p.role})</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {groups.length === 0 && <p className="text-center text-text-muted py-12">Nenhuma turma criada ainda.</p>}
        </div>
      )}
    </div>
  )
}
