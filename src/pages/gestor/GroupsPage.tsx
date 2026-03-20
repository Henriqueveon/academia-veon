import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, Users, UserPlus, Copy, Check } from 'lucide-react'

export function GroupsPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [managingGroup, setManagingGroup] = useState<string | null>(null)
  const [creatingInGroup, setCreatingInGroup] = useState<string | null>(null)
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '' })
  const [createdInfo, setCreatedInfo] = useState<{ email: string; password: string } | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

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

  // Create user directly into this group
  const createUserMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const { data: newUserId, error } = await supabase.rpc('admin_create_user', {
        user_email: newUser.email,
        user_password: newUser.password,
        user_name: newUser.name,
        user_role: 'tripulante',
      })
      if (error) throw error

      // Add to this group
      if (newUserId) {
        await supabase.from('user_groups').insert({ user_id: newUserId, group_id: groupId })
      }

      return { email: newUser.email, password: newUser.password }
    },
    onSuccess: (info) => {
      setCreatedInfo(info)
      queryClient.invalidateQueries({ queryKey: ['gestor-profiles'] })
      queryClient.invalidateQueries({ queryKey: ['gestor-user-groups'] })
      queryClient.invalidateQueries({ queryKey: ['gestor-users'] })
      setNewUser({ name: '', email: '', password: '' })
    },
  })

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  function getMembersOfGroup(groupId: string) {
    const memberIds = userGroups.filter((ug: any) => ug.group_id === groupId).map((ug: any) => ug.user_id)
    return profiles.filter((p: any) => memberIds.includes(p.id))
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
          {groups.map((g: any) => {
            const members = getMembersOfGroup(g.id)
            const isManaging = managingGroup === g.id
            const isCreating = creatingInGroup === g.id
            return (
              <div key={g.id} className="bg-bg-card border border-navy-800 rounded-xl p-4">
                <div className="flex items-center gap-4">
                  <Users className="w-5 h-5 text-navy-400" />
                  <div className="flex-1">
                    <h3 className="font-medium text-text-primary">{g.name}</h3>
                    <p className="text-xs text-text-muted">{members.length} membro(s)</p>
                  </div>
                  <button
                    onClick={() => { setManagingGroup(isManaging ? null : g.id); setCreatingInGroup(null); setCreatedInfo(null) }}
                    className={`p-2 transition-colors ${isManaging ? 'text-red-veon' : 'text-text-muted hover:text-text-primary'}`}
                    title="Gerenciar membros"
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
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-text-secondary">Gerenciar membros:</p>
                      <button
                        onClick={() => { setCreatingInGroup(isCreating ? null : g.id); setCreatedInfo(null); setNewUser({ name: '', email: '', password: '' }) }}
                        className="flex items-center gap-1.5 text-xs bg-red-veon hover:bg-red-veon-dark text-white px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Novo Tripulante
                      </button>
                    </div>

                    {/* Create user inline */}
                    {isCreating && !createdInfo && (
                      <div className="bg-bg-secondary border border-navy-700 rounded-lg p-4 mb-4">
                        <p className="text-sm font-medium text-text-primary mb-3">Criar tripulante na turma "{g.name}"</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <input
                            value={newUser.name}
                            onChange={(e) => setNewUser(f => ({ ...f, name: e.target.value }))}
                            className="bg-bg-input border border-navy-700 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-red-veon"
                            placeholder="Nome"
                          />
                          <input
                            type="email"
                            value={newUser.email}
                            onChange={(e) => setNewUser(f => ({ ...f, email: e.target.value }))}
                            className="bg-bg-input border border-navy-700 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-red-veon"
                            placeholder="Email"
                          />
                          <input
                            type="text"
                            value={newUser.password}
                            onChange={(e) => setNewUser(f => ({ ...f, password: e.target.value }))}
                            className="bg-bg-input border border-navy-700 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-red-veon"
                            placeholder="Senha"
                          />
                        </div>
                        {createUserMutation.isError && (
                          <p className="text-red-veon text-xs mt-2">{(createUserMutation.error as Error).message}</p>
                        )}
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => createUserMutation.mutate(g.id)}
                            disabled={!newUser.name || !newUser.email || !newUser.password || createUserMutation.isPending}
                            className="bg-red-veon hover:bg-red-veon-dark text-white text-xs px-4 py-2 rounded-lg disabled:opacity-50"
                          >
                            {createUserMutation.isPending ? 'Criando...' : 'Criar e adicionar à turma'}
                          </button>
                          <button onClick={() => setCreatingInGroup(null)} className="text-xs text-text-muted hover:text-text-primary px-3 py-2">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Created confirmation */}
                    {createdInfo && isCreating && (
                      <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 mb-4">
                        <p className="text-green-400 text-sm font-semibold mb-2">Tripulante criado e adicionado à turma!</p>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-text-muted w-12">Email:</span>
                            <code className="bg-bg-input px-2 py-0.5 rounded text-xs flex-1">{createdInfo.email}</code>
                            <button onClick={() => copyToClipboard(createdInfo.email, 'g-email')} className="text-text-muted hover:text-text-primary">
                              {copiedField === 'g-email' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-text-muted w-12">Senha:</span>
                            <code className="bg-bg-input px-2 py-0.5 rounded text-xs flex-1">{createdInfo.password}</code>
                            <button onClick={() => copyToClipboard(createdInfo.password, 'g-pass')} className="text-text-muted hover:text-text-primary">
                              {copiedField === 'g-pass' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                        <button onClick={() => { setCreatedInfo(null); setCreatingInGroup(null) }} className="text-xs text-text-muted hover:text-text-primary mt-3">
                          Fechar
                        </button>
                      </div>
                    )}

                    {/* Existing members */}
                    <div className="space-y-2">
                      {profiles.map((p: any) => {
                        const isMember = userGroups.some((ug: any) => ug.user_id === p.id && ug.group_id === g.id)
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
