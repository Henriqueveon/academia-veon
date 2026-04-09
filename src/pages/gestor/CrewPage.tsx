import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, Copy, Check, Pencil, X, Mail, Lock, User, Calendar, Shield, Layers, Phone, CreditCard } from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  name: string
  role: string
  cpf: string | null
  whatsapp: string | null
  created_at: string
}

export function CrewPage() {
  const queryClient = useQueryClient()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'tripulante', groupIds: [] as string[] })
  const [createdInfo, setCreatedInfo] = useState<{ email: string; password: string } | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [editForm, setEditForm] = useState({ name: '', role: '' })
  const [editEmailForm, setEditEmailForm] = useState({ email: '' })
  const [editPasswordForm, setEditPasswordForm] = useState({ password: '' })
  const [showEmailEdit, setShowEmailEdit] = useState(false)
  const [showPasswordEdit, setShowPasswordEdit] = useState(false)
  const [managingModules, setManagingModules] = useState<string | null>(null)

  // Fetch users via RPC (includes email from auth.users)
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['gestor-users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_users')
      if (error) {
        // Fallback to profiles only
        const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
        return (profiles || []).map((p: any) => ({ ...p, email: '—' })) as UserProfile[]
      }
      return (data || []) as UserProfile[]
    },
  })

  // Fetch modules
  const { data: modules = [] } = useQuery({
    queryKey: ['gestor-modules'],
    queryFn: async () => {
      const { data } = await supabase.from('modules').select('*').order('sort_order')
      return data || []
    },
  })

  // Fetch groups
  const { data: groups = [] } = useQuery({
    queryKey: ['gestor-groups'],
    queryFn: async () => {
      const { data } = await supabase.from('groups').select('*').order('name')
      return data || []
    },
  })

  // Fetch user_groups
  const { data: userGroups = [] } = useQuery({
    queryKey: ['gestor-user-groups'],
    queryFn: async () => {
      const { data } = await supabase.from('user_groups').select('*')
      return data || []
    },
  })

  // Fetch module_groups
  const { data: moduleGroups = [] } = useQuery({
    queryKey: ['gestor-module-groups'],
    queryFn: async () => {
      const { data } = await supabase.from('module_groups').select('*')
      return data || []
    },
  })

  // Create user
  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: newUserId, error } = await supabase.rpc('admin_create_user', {
        user_email: createForm.email,
        user_password: createForm.password,
        user_name: createForm.name,
        user_role: createForm.role,
      })
      if (error) throw error

      // Add user to selected groups
      if (createForm.groupIds.length > 0 && newUserId) {
        const rows = createForm.groupIds.map(gid => ({ user_id: newUserId, group_id: gid }))
        await supabase.from('user_groups').insert(rows)
      }

      return { email: createForm.email, password: createForm.password }
    },
    onSuccess: (info) => {
      setCreatedInfo(info)
      queryClient.invalidateQueries({ queryKey: ['gestor-users'] })
      queryClient.invalidateQueries({ queryKey: ['gestor-user-groups'] })
      setCreateForm({ name: '', email: '', password: '', role: 'tripulante', groupIds: [] })
    },
  })

  // Update profile (name, role)
  const updateProfileMutation = useMutation({
    mutationFn: async (userId: string) => {
      await supabase.from('profiles').update({
        name: editForm.name,
        role: editForm.role,
      }).eq('id', userId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestor-users'] })
      setEditingUser(null)
    },
  })

  // Update email
  const updateEmailMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('admin_update_user_email', {
        target_user_id: userId,
        new_email: editEmailForm.email,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestor-users'] })
      setShowEmailEdit(false)
      setEditEmailForm({ email: '' })
    },
  })

  // Update password
  const updatePasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('admin_update_user_password', {
        target_user_id: userId,
        new_password: editPasswordForm.password,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setShowPasswordEdit(false)
      setEditPasswordForm({ password: '' })
    },
  })

  // Delete user
  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('admin_delete_user', { target_user_id: userId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestor-users'] })
      setEditingUser(null)
    },
  })

  // Toggle user-group membership
  const toggleGroupMutation = useMutation({
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

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  function startEdit(user: UserProfile) {
    setEditingUser(user)
    setEditForm({ name: user.name, role: user.role })
    setEditEmailForm({ email: user.email })
    setShowEmailEdit(false)
    setShowPasswordEdit(false)
    setManagingModules(null)
  }

  function getUserGroups(userId: string) {
    return userGroups.filter((ug: any) => ug.user_id === userId).map((ug: any) => ug.group_id)
  }

  function getAccessibleModules(userId: string) {
    const gIds = getUserGroups(userId)
    const moduleIds = moduleGroups.filter((mg: any) => gIds.includes(mg.group_id)).map((mg: any) => mg.module_id)
    return [...new Set(moduleIds)]
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
        <h1 className="text-2xl font-bold">Tripulantes</h1>
        <button
          onClick={() => { setShowCreateForm(true); setCreatedInfo(null); setEditingUser(null) }}
          className="flex items-center gap-2 bg-red-veon hover:bg-red-veon-dark text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo Tripulante
        </button>
      </div>

      {/* Created confirmation */}
      {createdInfo && (
        <div className="bg-green-900/20 border border-green-800 rounded-xl p-6 mb-8">
          <h3 className="text-green-400 font-semibold mb-3">Tripulante criado com sucesso!</h3>
          <p className="text-sm text-text-secondary mb-4">Compartilhe os dados de acesso:</p>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-muted w-16">Email:</span>
              <code className="bg-bg-input px-3 py-1 rounded text-sm flex-1">{createdInfo.email}</code>
              <button onClick={() => copyToClipboard(createdInfo.email, 'c-email')} className="text-text-muted hover:text-text-primary">
                {copiedField === 'c-email' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-muted w-16">Senha:</span>
              <code className="bg-bg-input px-3 py-1 rounded text-sm flex-1">{createdInfo.password}</code>
              <button onClick={() => copyToClipboard(createdInfo.password, 'c-pass')} className="text-text-muted hover:text-text-primary">
                {copiedField === 'c-pass' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button onClick={() => setCreatedInfo(null)} className="mt-4 text-sm text-text-muted hover:text-text-primary">Fechar</button>
        </div>
      )}

      {/* Create form */}
      {showCreateForm && !createdInfo && (
        <div className="bg-bg-card border border-navy-800 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Novo Tripulante</h2>
            <button onClick={() => setShowCreateForm(false)} className="text-text-muted hover:text-text-primary">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Nome *</label>
              <input
                value={createForm.name}
                onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Email *</label>
              <input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Senha *</label>
              <input
                type="text"
                value={createForm.password}
                onChange={(e) => setCreateForm(f => ({ ...f, password: e.target.value }))}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
                placeholder="Senha inicial"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Tipo</label>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm(f => ({ ...f, role: e.target.value }))}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
              >
                <option value="tripulante">Tripulante</option>
                <option value="gestor">Gestor</option>
              </select>
            </div>
          </div>

          {/* Turmas selection */}
          {groups.length > 0 && (
            <div className="mt-4">
              <label className="block text-sm text-text-secondary mb-2">Turmas (acesso aos módulos)</label>
              <div className="bg-bg-input border border-navy-700 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                {groups.map((g: any) => {
                  const isSelected = createForm.groupIds.includes(g.id)
                  const groupModules = moduleGroups
                    .filter((mg: any) => mg.group_id === g.id)
                    .map((mg: any) => modules.find((m: any) => m.id === mg.module_id))
                    .filter(Boolean)
                  return (
                    <label key={g.id} className="flex items-start gap-3 cursor-pointer hover:bg-bg-card-hover p-2 rounded-lg">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setCreateForm(f => ({
                            ...f,
                            groupIds: isSelected
                              ? f.groupIds.filter(id => id !== g.id)
                              : [...f.groupIds, g.id]
                          }))
                        }}
                        className="w-4 h-4 rounded accent-red-veon mt-0.5"
                      />
                      <div>
                        <span className="text-sm text-text-primary font-medium">{g.name}</span>
                        {groupModules.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {groupModules.map((m: any) => (
                              <span key={m.id} className="text-xs bg-navy-800 text-text-muted px-1.5 py-0.5 rounded">
                                {m.title}
                              </span>
                            ))}
                          </div>
                        )}
                        {groupModules.length === 0 && (
                          <span className="text-xs text-text-muted">Nenhum módulo vinculado</span>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {createMutation.isError && (
            <p className="text-red-veon text-sm mt-3">{(createMutation.error as Error).message}</p>
          )}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!createForm.name || !createForm.email || !createForm.password || createMutation.isPending}
              className="bg-red-veon hover:bg-red-veon-dark text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Criando...' : 'Criar Tripulante'}
            </button>
            <button onClick={() => setShowCreateForm(false)} className="bg-bg-input text-text-secondary hover:text-text-primary px-6 py-2 rounded-lg transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Edit panel */}
      {editingUser && (
        <div className="bg-bg-card border border-navy-800 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-navy-900 rounded-full flex items-center justify-center text-lg font-bold text-red-veon">
                {editingUser.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-semibold">Editar Tripulante</h2>
                <p className="text-xs text-text-muted">ID: {editingUser.id.slice(0, 8)}...</p>
              </div>
            </div>
            <button onClick={() => setEditingUser(null)} className="text-text-muted hover:text-text-primary">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Basic info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="flex items-center gap-1.5 text-sm text-text-secondary mb-1">
                <User className="w-3.5 h-3.5" /> Nome
              </label>
              <input
                value={editForm.name}
                onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm text-text-secondary mb-1">
                <Shield className="w-3.5 h-3.5" /> Tipo
              </label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm(f => ({ ...f, role: e.target.value }))}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
              >
                <option value="tripulante">Tripulante</option>
                <option value="gestor">Gestor</option>
              </select>
            </div>
          </div>

          {/* CPF e WhatsApp (somente leitura) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="flex items-center gap-1.5 text-sm text-text-secondary mb-1">
                <CreditCard className="w-3.5 h-3.5" /> CPF
              </label>
              <div className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-muted text-sm">
                {editingUser.cpf
                  ? editingUser.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
                  : '—'}
              </div>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm text-text-secondary mb-1">
                <Phone className="w-3.5 h-3.5" /> WhatsApp
              </label>
              <div className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-muted text-sm">
                {editingUser.whatsapp
                  ? editingUser.whatsapp.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
                  : '—'}
              </div>
            </div>
          </div>
          <button
            onClick={() => updateProfileMutation.mutate(editingUser.id)}
            disabled={updateProfileMutation.isPending}
            className="bg-red-veon hover:bg-red-veon-dark text-white text-sm px-5 py-2 rounded-lg transition-colors disabled:opacity-50 mb-6"
          >
            {updateProfileMutation.isPending ? 'Salvando...' : 'Salvar Nome/Tipo'}
          </button>

          <div className="border-t border-navy-800 pt-6 space-y-4">
            {/* Email edit */}
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-text-muted" />
                  <span className="text-sm text-text-secondary">Email:</span>
                  <span className="text-sm text-text-primary">{editingUser.email}</span>
                </div>
                <button
                  onClick={() => { setShowEmailEdit(!showEmailEdit); setEditEmailForm({ email: editingUser.email }) }}
                  className="text-xs text-text-muted hover:text-text-primary"
                >
                  {showEmailEdit ? 'Cancelar' : 'Alterar email'}
                </button>
              </div>
              {showEmailEdit && (
                <div className="flex gap-3 mt-2">
                  <input
                    type="email"
                    value={editEmailForm.email}
                    onChange={(e) => setEditEmailForm({ email: e.target.value })}
                    className="flex-1 bg-bg-input border border-navy-700 rounded-lg px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-red-veon"
                    placeholder="Novo email"
                  />
                  <button
                    onClick={() => updateEmailMutation.mutate(editingUser.id)}
                    disabled={!editEmailForm.email || updateEmailMutation.isPending}
                    className="bg-navy-800 hover:bg-navy-700 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50"
                  >
                    {updateEmailMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              )}
              {updateEmailMutation.isError && (
                <p className="text-red-veon text-xs mt-1">{(updateEmailMutation.error as Error).message}</p>
              )}
            </div>

            {/* Password edit */}
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-text-muted" />
                  <span className="text-sm text-text-secondary">Senha:</span>
                  <span className="text-sm text-text-muted">••••••••</span>
                </div>
                <button
                  onClick={() => { setShowPasswordEdit(!showPasswordEdit); setEditPasswordForm({ password: '' }) }}
                  className="text-xs text-text-muted hover:text-text-primary"
                >
                  {showPasswordEdit ? 'Cancelar' : 'Alterar senha'}
                </button>
              </div>
              {showPasswordEdit && (
                <div className="flex gap-3 mt-2">
                  <input
                    type="text"
                    value={editPasswordForm.password}
                    onChange={(e) => setEditPasswordForm({ password: e.target.value })}
                    className="flex-1 bg-bg-input border border-navy-700 rounded-lg px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-red-veon"
                    placeholder="Nova senha (mín. 6 caracteres)"
                  />
                  <button
                    onClick={() => updatePasswordMutation.mutate(editingUser.id)}
                    disabled={!editPasswordForm.password || editPasswordForm.password.length < 6 || updatePasswordMutation.isPending}
                    className="bg-navy-800 hover:bg-navy-700 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50"
                  >
                    {updatePasswordMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              )}
              {updatePasswordMutation.isError && (
                <p className="text-red-veon text-xs mt-1">{(updatePasswordMutation.error as Error).message}</p>
              )}
            </div>

            {/* Module access */}
            <div className="border-t border-navy-800 pt-4">
              <button
                onClick={() => setManagingModules(managingModules ? null : editingUser.id)}
                className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary"
              >
                <Layers className="w-4 h-4" />
                Gerenciar acesso aos módulos
              </button>

              {managingModules === editingUser.id && (
                <div className="mt-4 space-y-3">
                  <p className="text-xs text-text-muted">
                    O acesso é controlado por turmas. Adicione o tripulante às turmas que dão acesso aos módulos desejados.
                  </p>

                  {/* Groups this user belongs to */}
                  <div>
                    <p className="text-xs text-text-secondary font-semibold mb-2">Turmas deste tripulante:</p>
                    {groups.length === 0 ? (
                      <p className="text-xs text-text-muted">Nenhuma turma criada. Crie turmas primeiro.</p>
                    ) : (
                      <div className="space-y-1">
                        {groups.map((g: any) => {
                          const isMember = userGroups.some((ug: any) => ug.user_id === editingUser.id && ug.group_id === g.id)
                          return (
                            <label key={g.id} className="flex items-center gap-3 cursor-pointer hover:bg-bg-card-hover p-2 rounded-lg">
                              <input
                                type="checkbox"
                                checked={isMember}
                                onChange={() => toggleGroupMutation.mutate({ userId: editingUser.id, groupId: g.id, add: !isMember })}
                                className="w-4 h-4 rounded accent-red-veon"
                              />
                              <span className="text-sm text-text-primary">{g.name}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Modules accessible */}
                  <div>
                    <p className="text-xs text-text-secondary font-semibold mb-2">Módulos acessíveis:</p>
                    {modules.length === 0 ? (
                      <p className="text-xs text-text-muted">Nenhum módulo criado.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {modules.map((m: any) => {
                          const hasAccess = getAccessibleModules(editingUser.id).includes(m.id)
                          return (
                            <span
                              key={m.id}
                              className={`text-xs px-3 py-1.5 rounded-lg ${
                                hasAccess
                                  ? 'bg-green-900/30 text-green-400 border border-green-800'
                                  : 'bg-bg-input text-text-muted border border-navy-800'
                              }`}
                            >
                              {hasAccess ? '✓' : '✗'} {m.title}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Delete */}
            <div className="border-t border-navy-800 pt-4">
              <button
                onClick={() => {
                  if (confirm(`ATENÇÃO: Excluir ${editingUser.name} permanentemente? Esta ação não pode ser desfeita.`)) {
                    deleteMutation.mutate(editingUser.id)
                  }
                }}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-2 text-sm text-red-veon hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {deleteMutation.isPending ? 'Excluindo...' : 'Excluir tripulante permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User list */}
      <div className="space-y-3">
        {users.map((u: UserProfile) => {
          const accessibleModules = getAccessibleModules(u.id)
          const uGroups = getUserGroups(u.id)
          const groupNames = groups.filter((g: any) => uGroups.includes(g.id)).map((g: any) => g.name)

          return (
            <div
              key={u.id}
              className={`bg-bg-card border rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-navy-600 transition-colors ${
                editingUser?.id === u.id ? 'border-red-veon' : 'border-navy-800'
              }`}
              onClick={() => startEdit(u)}
            >
              <div className="w-11 h-11 bg-navy-900 rounded-full flex items-center justify-center text-sm font-bold text-text-primary flex-shrink-0">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-text-primary">{u.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    u.role === 'gestor' ? 'bg-red-veon/20 text-red-veon' : 'bg-navy-800 text-text-muted'
                  }`}>
                    {u.role}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                  <span className="text-xs text-text-muted flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {u.email}
                  </span>
                  {u.cpf && (
                    <span className="text-xs text-text-muted flex items-center gap-1">
                      <CreditCard className="w-3 h-3" /> {u.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                    </span>
                  )}
                  {u.whatsapp && (
                    <span className="text-xs text-text-muted flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {u.whatsapp.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                    </span>
                  )}
                  <span className="text-xs text-text-muted flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {formatDate(u.created_at)}
                  </span>
                </div>
                {groupNames.length > 0 && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <Shield className="w-3 h-3 text-text-muted" />
                    {groupNames.map((name: string) => (
                      <span key={name} className="text-xs bg-navy-800 text-text-muted px-1.5 py-0.5 rounded">{name}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-text-muted">{accessibleModules.length} módulo(s)</span>
                <Pencil className="w-4 h-4 text-text-muted" />
              </div>
            </div>
          )
        })}
        {users.length === 0 && <p className="text-center text-text-muted py-12">Nenhum tripulante cadastrado.</p>}
      </div>
    </div>
  )
}
