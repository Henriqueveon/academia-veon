import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, Copy, Check } from 'lucide-react'

interface ProfileWithEmail {
  id: string
  name: string
  role: string
  created_at: string
  email?: string
}

export function CrewPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<{ name: string; email: string; password: string; role: string }>({ name: '', email: '', password: '', role: 'tripulante' })
  const [createdInfo, setCreatedInfo] = useState<{ email: string; password: string } | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['gestor-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      return (data || []) as ProfileWithEmail[]
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      // Create auth user via Supabase
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      })
      if (error) throw error
      if (!data.user) throw new Error('Falha ao criar usuário')

      // Create profile
      await supabase.from('profiles').insert({
        id: data.user.id,
        name: form.name,
        role: form.role,
      })

      return { email: form.email, password: form.password }
    },
    onSuccess: (info) => {
      setCreatedInfo(info)
      queryClient.invalidateQueries({ queryKey: ['gestor-profiles'] })
      setForm({ name: '', email: '', password: '', role: 'tripulante' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('profiles').delete().eq('id', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestor-profiles'] })
    },
  })

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Tripulantes</h1>
        <button
          onClick={() => { setShowForm(true); setCreatedInfo(null) }}
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
              <button onClick={() => copyToClipboard(createdInfo.email, 'email')} className="text-text-muted hover:text-text-primary">
                {copiedField === 'email' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-muted w-16">Senha:</span>
              <code className="bg-bg-input px-3 py-1 rounded text-sm flex-1">{createdInfo.password}</code>
              <button onClick={() => copyToClipboard(createdInfo.password, 'password')} className="text-text-muted hover:text-text-primary">
                {copiedField === 'password' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button onClick={() => setCreatedInfo(null)} className="mt-4 text-sm text-text-muted hover:text-text-primary">Fechar</button>
        </div>
      )}

      {/* Form */}
      {showForm && !createdInfo && (
        <div className="bg-bg-card border border-navy-800 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Novo Tripulante</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Nome *</label>
              <input
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Senha *</label>
              <input
                type="text"
                value={form.password}
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
                placeholder="Senha inicial"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Tipo</label>
              <select
                value={form.role}
                onChange={(e) => setForm(f => ({ ...f, role: e.target.value as 'tripulante' | 'gestor' }))}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
              >
                <option value="tripulante">Tripulante</option>
                <option value="gestor">Gestor</option>
              </select>
            </div>
          </div>
          {createMutation.isError && (
            <p className="text-red-veon text-sm mt-3">{(createMutation.error as Error).message}</p>
          )}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!form.name || !form.email || !form.password || createMutation.isPending}
              className="bg-red-veon hover:bg-red-veon-dark text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Criando...' : 'Criar'}
            </button>
            <button onClick={() => setShowForm(false)} className="bg-bg-input text-text-secondary hover:text-text-primary px-6 py-2 rounded-lg transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-red-veon border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map((p) => (
            <div key={p.id} className="bg-bg-card border border-navy-800 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-navy-900 rounded-full flex items-center justify-center text-sm font-bold text-text-primary">
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-text-primary">{p.name}</h3>
                <p className="text-xs text-text-muted capitalize">{p.role}</p>
              </div>
              <button
                onClick={() => { if (confirm(`Excluir ${p.name}?`)) deleteMutation.mutate(p.id) }}
                className="p-2 text-text-muted hover:text-red-veon transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {profiles.length === 0 && <p className="text-center text-text-muted py-12">Nenhum tripulante cadastrado.</p>}
        </div>
      )}
    </div>
  )
}
