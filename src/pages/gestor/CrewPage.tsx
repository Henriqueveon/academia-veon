import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, Copy, Check, X, Mail, Lock, User, Calendar, Shield, Layers, Phone, CreditCard, BookOpen, Search } from 'lucide-react'

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
  const [managingModules, setManagingModules] = useState(false)
  const [managingTrainings, setManagingTrainings] = useState(false)

  // Filters
  const [filterName, setFilterName] = useState('')
  const [filterGroupId, setFilterGroupId] = useState('')
  const [filterTrainingId, setFilterTrainingId] = useState('')

  // Fetch users via RPC
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['gestor-users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_users')
      if (error) {
        const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
        return (profiles || []).map((p: any) => ({ ...p, email: '—' })) as UserProfile[]
      }
      return (data || []) as UserProfile[]
    },
  })

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

  const { data: userGroups = [] } = useQuery({
    queryKey: ['gestor-user-groups'],
    queryFn: async () => {
      const { data } = await supabase.from('user_groups').select('*')
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

  const { data: trainings = [] } = useQuery({
    queryKey: ['gestor-trainings'],
    queryFn: async () => {
      const { data } = await supabase.from('trainings').select('*').order('sort_order')
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

  const { data: userTrainings = [] } = useQuery({
    queryKey: ['gestor-user-trainings'],
    queryFn: async () => {
      const { data } = await supabase.from('user_trainings').select('*')
      return data || []
    },
  })

  // Mutations
  const toggleUserTraining = useMutation({
    mutationFn: async ({ userId, trainingId, grant }: { userId: string; trainingId: string; grant: boolean }) => {
      if (grant) {
        await supabase.from('user_trainings').insert({ user_id: userId, training_id: trainingId })
      } else {
        await supabase.from('user_trainings').delete().eq('user_id', userId).eq('training_id', trainingId)
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gestor-user-trainings'] }),
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: newUserId, error } = await supabase.rpc('admin_create_user', {
        user_email: createForm.email,
        user_password: createForm.password,
        user_name: createForm.name,
        user_role: createForm.role,
      })
      if (error) throw error
      if (createForm.groupIds.length > 0 && newUserId) {
        await supabase.from('user_groups').insert(createForm.groupIds.map(gid => ({ user_id: newUserId, group_id: gid })))
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

  const updateProfileMutation = useMutation({
    mutationFn: async (userId: string) => {
      await supabase.from('profiles').update({ name: editForm.name, role: editForm.role }).eq('id', userId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestor-users'] })
    },
  })

  const updateEmailMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('admin_update_user_email', { target_user_id: userId, new_email: editEmailForm.email })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestor-users'] })
      setShowEmailEdit(false)
    },
  })

  const updatePasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('admin_update_user_password', { target_user_id: userId, new_password: editPasswordForm.password })
      if (error) throw error
    },
    onSuccess: () => {
      setShowPasswordEdit(false)
      setEditPasswordForm({ password: '' })
    },
  })

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

  const toggleGroupMutation = useMutation({
    mutationFn: async ({ userId, groupId, add }: { userId: string; groupId: string; add: boolean }) => {
      if (add) {
        await supabase.from('user_groups').insert({ user_id: userId, group_id: groupId })
      } else {
        await supabase.from('user_groups').delete().eq('user_id', userId).eq('group_id', groupId)
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gestor-user-groups'] }),
  })

  // Helpers
  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  function openEditModal(user: UserProfile) {
    setEditingUser(user)
    setEditForm({ name: user.name, role: user.role })
    setEditEmailForm({ email: user.email })
    setShowEmailEdit(false)
    setShowPasswordEdit(false)
    setManagingModules(false)
    setManagingTrainings(false)
  }

  function getUserGroupIds(userId: string) {
    return userGroups.filter((ug: any) => ug.user_id === userId).map((ug: any) => ug.group_id)
  }

  function hasTrainingAccess(userId: string, trainingId: string) {
    if (userTrainings.some((ut: any) => ut.user_id === userId && ut.training_id === trainingId)) return 'direct'
    const gIds = getUserGroupIds(userId)
    if (trainingGroups.some((tg: any) => tg.training_id === trainingId && gIds.includes(tg.group_id))) return 'group'
    return false
  }

  function getUserTrainingIds(userId: string) {
    const ids = new Set<string>()
    // Direct
    userTrainings.filter((ut: any) => ut.user_id === userId).forEach((ut: any) => ids.add(ut.training_id))
    // Via groups
    const gIds = getUserGroupIds(userId)
    trainingGroups.filter((tg: any) => gIds.includes(tg.group_id)).forEach((tg: any) => ids.add(tg.training_id))
    return ids
  }

  function getAccessibleModules(userId: string) {
    const gIds = getUserGroupIds(userId)
    const moduleIds = moduleGroups.filter((mg: any) => gIds.includes(mg.group_id)).map((mg: any) => mg.module_id)
    return [...new Set(moduleIds)]
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // Filter users
  const filteredUsers = users.filter((u: UserProfile) => {
    if (filterName && !u.name.toLowerCase().includes(filterName.toLowerCase())) return false
    if (filterGroupId && !getUserGroupIds(u.id).includes(filterGroupId)) return false
    if (filterTrainingId && !getUserTrainingIds(u.id).has(filterTrainingId)) return false
    return true
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tripulantes</h1>
        <button
          onClick={() => { setShowCreateForm(true); setCreatedInfo(null) }}
          className="flex items-center gap-2 bg-red-veon hover:bg-red-veon-dark text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo Tripulante
        </button>
      </div>

      {/* Created confirmation */}
      {createdInfo && (
        <div className="bg-green-900/20 border border-green-800 rounded-xl p-6 mb-6">
          <h3 className="text-green-400 font-semibold mb-3">Tripulante criado com sucesso!</h3>
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
        <div className="bg-bg-card border border-navy-800 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Novo Tripulante</h2>
            <button onClick={() => setShowCreateForm(false)} className="text-text-muted hover:text-text-primary"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Nome *</label>
              <input value={createForm.name} onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon" placeholder="Nome completo" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Email *</label>
              <input type="email" value={createForm.email} onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))} className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon" placeholder="email@exemplo.com" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Senha *</label>
              <input type="text" value={createForm.password} onChange={(e) => setCreateForm(f => ({ ...f, password: e.target.value }))} className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon" placeholder="Senha inicial" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Tipo</label>
              <select value={createForm.role} onChange={(e) => setCreateForm(f => ({ ...f, role: e.target.value }))} className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon">
                <option value="tripulante">Tripulante</option>
                <option value="gestor">Gestor</option>
              </select>
            </div>
          </div>
          {createMutation.isError && <p className="text-red-veon text-sm mt-3">{(createMutation.error as Error).message}</p>}
          <div className="flex gap-3 mt-4">
            <button onClick={() => createMutation.mutate()} disabled={!createForm.name || !createForm.email || !createForm.password || createMutation.isPending} className="bg-red-veon hover:bg-red-veon-dark text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50">
              {createMutation.isPending ? 'Criando...' : 'Criar Tripulante'}
            </button>
            <button onClick={() => setShowCreateForm(false)} className="bg-bg-input text-text-secondary hover:text-text-primary px-6 py-2 rounded-lg transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-bg-card border border-navy-800 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              className="w-full bg-bg-input border border-navy-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-red-veon"
              placeholder="Buscar por nome..."
            />
          </div>
          <select
            value={filterGroupId}
            onChange={(e) => setFilterGroupId(e.target.value)}
            className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-red-veon"
          >
            <option value="">Todas as turmas</option>
            {groups.map((g: any) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <select
            value={filterTrainingId}
            onChange={(e) => setFilterTrainingId(e.target.value)}
            className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-red-veon"
          >
            <option value="">Todos os treinamentos</option>
            {trainings.map((t: any) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>
        {(filterName || filterGroupId || filterTrainingId) && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-text-muted">{filteredUsers.length} resultado(s)</span>
            <button onClick={() => { setFilterName(''); setFilterGroupId(''); setFilterTrainingId('') }} className="text-xs text-red-veon hover:text-red-400">Limpar filtros</button>
          </div>
        )}
      </div>

      {/* User list */}
      <div className="space-y-3">
        {filteredUsers.map((u: UserProfile) => {
          const uGroups = getUserGroupIds(u.id)
          const groupNames = groups.filter((g: any) => uGroups.includes(g.id)).map((g: any) => g.name)

          return (
            <div
              key={u.id}
              className="bg-bg-card border border-navy-800 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-navy-600 transition-colors"
              onClick={() => openEditModal(u)}
            >
              <div className="w-11 h-11 bg-navy-900 rounded-full flex items-center justify-center text-sm font-bold text-text-primary flex-shrink-0">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-text-primary">{u.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${u.role === 'gestor' ? 'bg-red-veon/20 text-red-veon' : 'bg-navy-800 text-text-muted'}`}>{u.role}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                  <span className="text-xs text-text-muted flex items-center gap-1"><Mail className="w-3 h-3" /> {u.email}</span>
                  {u.cpf && <span className="text-xs text-text-muted flex items-center gap-1"><CreditCard className="w-3 h-3" /> {u.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</span>}
                  {u.whatsapp && <span className="text-xs text-text-muted flex items-center gap-1"><Phone className="w-3 h-3" /> {u.whatsapp.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}</span>}
                  <span className="text-xs text-text-muted flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(u.created_at)}</span>
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
            </div>
          )
        })}
        {filteredUsers.length === 0 && <p className="text-center text-text-muted py-12">Nenhum tripulante encontrado.</p>}
      </div>

      {/* ======== EDIT MODAL ======== */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setEditingUser(null)}>
          <div className="bg-bg-card border border-navy-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-navy-800 sticky top-0 bg-bg-card rounded-t-2xl z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-navy-900 rounded-full flex items-center justify-center text-lg font-bold text-red-veon">
                  {editingUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Editar Tripulante</h2>
                  <p className="text-xs text-text-muted">{editingUser.email}</p>
                </div>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-text-muted hover:text-text-primary p-1"><X className="w-6 h-6" /></button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic info */}
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-sm text-text-secondary mb-1"><User className="w-3.5 h-3.5" /> Nome</label>
                    <input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-sm text-text-secondary mb-1"><Shield className="w-3.5 h-3.5" /> Tipo</label>
                    <select value={editForm.role} onChange={(e) => setEditForm(f => ({ ...f, role: e.target.value }))} className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon">
                      <option value="tripulante">Tripulante</option>
                      <option value="gestor">Gestor</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-sm text-text-secondary mb-1"><CreditCard className="w-3.5 h-3.5" /> CPF</label>
                    <div className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-muted text-sm">
                      {editingUser.cpf ? editingUser.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '—'}
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-sm text-text-secondary mb-1"><Phone className="w-3.5 h-3.5" /> WhatsApp</label>
                    <div className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-muted text-sm">
                      {editingUser.whatsapp ? editingUser.whatsapp.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : '—'}
                    </div>
                  </div>
                </div>
                <button onClick={() => updateProfileMutation.mutate(editingUser.id)} disabled={updateProfileMutation.isPending} className="bg-red-veon hover:bg-red-veon-dark text-white text-sm px-5 py-2 rounded-lg transition-colors disabled:opacity-50">
                  {updateProfileMutation.isPending ? 'Salvando...' : 'Salvar Nome/Tipo'}
                </button>
              </div>

              {/* Email */}
              <div className="border-t border-navy-800 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-text-muted" />
                    <span className="text-sm text-text-secondary">Email:</span>
                    <span className="text-sm text-text-primary">{editingUser.email}</span>
                  </div>
                  <button onClick={() => { setShowEmailEdit(!showEmailEdit); setEditEmailForm({ email: editingUser.email }) }} className="text-xs text-text-muted hover:text-text-primary">
                    {showEmailEdit ? 'Cancelar' : 'Alterar email'}
                  </button>
                </div>
                {showEmailEdit && (
                  <div className="flex gap-3 mt-2">
                    <input type="email" value={editEmailForm.email} onChange={(e) => setEditEmailForm({ email: e.target.value })} className="flex-1 bg-bg-input border border-navy-700 rounded-lg px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-red-veon" placeholder="Novo email" />
                    <button onClick={() => updateEmailMutation.mutate(editingUser.id)} disabled={!editEmailForm.email || updateEmailMutation.isPending} className="bg-navy-800 hover:bg-navy-700 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">
                      {updateEmailMutation.isPending ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                )}
                {updateEmailMutation.isError && <p className="text-red-veon text-xs mt-1">{(updateEmailMutation.error as Error).message}</p>}
              </div>

              {/* Password */}
              <div className="border-t border-navy-800 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-text-muted" />
                    <span className="text-sm text-text-secondary">Senha:</span>
                    <span className="text-sm text-text-muted">••••••••</span>
                  </div>
                  <button onClick={() => { setShowPasswordEdit(!showPasswordEdit); setEditPasswordForm({ password: '' }) }} className="text-xs text-text-muted hover:text-text-primary">
                    {showPasswordEdit ? 'Cancelar' : 'Alterar senha'}
                  </button>
                </div>
                {showPasswordEdit && (
                  <div className="flex gap-3 mt-2">
                    <input type="text" value={editPasswordForm.password} onChange={(e) => setEditPasswordForm({ password: e.target.value })} className="flex-1 bg-bg-input border border-navy-700 rounded-lg px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-red-veon" placeholder="Nova senha (mín. 6 caracteres)" />
                    <button onClick={() => updatePasswordMutation.mutate(editingUser.id)} disabled={!editPasswordForm.password || editPasswordForm.password.length < 6 || updatePasswordMutation.isPending} className="bg-navy-800 hover:bg-navy-700 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">
                      {updatePasswordMutation.isPending ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                )}
                {updatePasswordMutation.isError && <p className="text-red-veon text-xs mt-1">{(updatePasswordMutation.error as Error).message}</p>}
              </div>

              {/* Turmas */}
              <div className="border-t border-navy-800 pt-4">
                <button onClick={() => setManagingModules(!managingModules)} className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary">
                  <Layers className="w-4 h-4" /> Gerenciar Turmas
                </button>
                {managingModules && (
                  <div className="mt-3 space-y-1">
                    {groups.map((g: any) => {
                      const isMember = userGroups.some((ug: any) => ug.user_id === editingUser.id && ug.group_id === g.id)
                      return (
                        <label key={g.id} className="flex items-center gap-3 cursor-pointer hover:bg-bg-card-hover p-2 rounded-lg">
                          <input type="checkbox" checked={isMember} onChange={() => toggleGroupMutation.mutate({ userId: editingUser.id, groupId: g.id, add: !isMember })} className="w-4 h-4 rounded accent-red-veon" />
                          <span className="text-sm text-text-primary">{g.name}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Direct training access */}
              <div className="border-t border-navy-800 pt-4">
                <button onClick={() => setManagingTrainings(!managingTrainings)} className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary">
                  <BookOpen className="w-4 h-4" /> Liberar Treinamentos
                </button>
                {managingTrainings && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-text-muted mb-2">Libere treinamentos diretamente, sem depender de turma.</p>
                    {trainings.map((t: any) => {
                      const access = hasTrainingAccess(editingUser.id, t.id)
                      const isDirect = access === 'direct'
                      const isGroup = access === 'group'
                      return (
                        <label key={t.id} className="flex items-center gap-3 cursor-pointer hover:bg-bg-card-hover p-2 rounded-lg">
                          <input type="checkbox" checked={isDirect} onChange={() => toggleUserTraining.mutate({ userId: editingUser.id, trainingId: t.id, grant: !isDirect })} className="w-4 h-4 rounded accent-red-veon" />
                          <div className="flex-1">
                            <span className="text-sm text-text-primary">{t.title}</span>
                            {isGroup && !isDirect && <span className="text-xs text-text-muted ml-2">(via turma)</span>}
                          </div>
                          {(isDirect || isGroup) && (
                            <span className={`text-xs px-2 py-0.5 rounded ${isDirect ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-navy-800 text-text-muted'}`}>
                              {isDirect ? 'Liberado' : 'Via turma'}
                            </span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Delete */}
              <div className="border-t border-navy-800 pt-4">
                <button
                  onClick={() => { if (confirm(`ATENÇÃO: Excluir ${editingUser.name} permanentemente?`)) deleteMutation.mutate(editingUser.id) }}
                  disabled={deleteMutation.isPending}
                  className="flex items-center gap-2 text-sm text-red-veon hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleteMutation.isPending ? 'Excluindo...' : 'Excluir tripulante permanentemente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
