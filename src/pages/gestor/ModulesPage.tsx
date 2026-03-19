import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react'
import type { Module } from '../../types/database'

export function ModulesPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Module | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', thumbnail_url: '', sort_order: 0 })

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ['gestor-modules'],
    queryFn: async () => {
      const { data } = await supabase.from('modules').select('*').order('sort_order')
      return data || []
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        await supabase.from('modules').update({
          title: form.title,
          description: form.description || null,
          thumbnail_url: form.thumbnail_url || null,
          sort_order: form.sort_order,
        }).eq('id', editing.id)
      } else {
        await supabase.from('modules').insert({
          title: form.title,
          description: form.description || null,
          thumbnail_url: form.thumbnail_url || null,
          sort_order: form.sort_order,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestor-modules'] })
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('modules').delete().eq('id', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestor-modules'] })
    },
  })

  function resetForm() {
    setForm({ title: '', description: '', thumbnail_url: '', sort_order: 0 })
    setEditing(null)
    setShowForm(false)
  }

  function startEdit(mod: Module) {
    setForm({
      title: mod.title,
      description: mod.description || '',
      thumbnail_url: mod.thumbnail_url || '',
      sort_order: mod.sort_order,
    })
    setEditing(mod)
    setShowForm(true)
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
        <h1 className="text-2xl font-bold">Módulos</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-2 bg-red-veon hover:bg-red-veon-dark text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo Módulo
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-bg-card border border-navy-800 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">{editing ? 'Editar Módulo' : 'Novo Módulo'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Título *</label>
              <input
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
                placeholder="Nome do módulo"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Ordem</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-text-secondary mb-1">Descrição</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
                rows={3}
                placeholder="Descrição do módulo"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-text-secondary mb-1">URL da Thumbnail</label>
              <input
                value={form.thumbnail_url}
                onChange={(e) => setForm(f => ({ ...f, thumbnail_url: e.target.value }))}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
                placeholder="https://..."
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!form.title || saveMutation.isPending}
              className="bg-red-veon hover:bg-red-veon-dark text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={resetForm}
              className="bg-bg-input text-text-secondary hover:text-text-primary px-6 py-2 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Module list */}
      <div className="space-y-3">
        {modules.map((mod) => (
          <div key={mod.id} className="bg-bg-card border border-navy-800 rounded-xl p-4 flex items-center gap-4">
            <GripVertical className="w-5 h-5 text-text-muted" />
            {mod.thumbnail_url && (
              <img src={mod.thumbnail_url} alt="" className="w-16 h-10 object-cover rounded" />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-text-primary">{mod.title}</h3>
              {mod.description && <p className="text-sm text-text-muted truncate">{mod.description}</p>}
            </div>
            <span className="text-xs text-text-muted">Ordem: {mod.sort_order}</span>
            <div className="flex gap-2">
              <button onClick={() => startEdit(mod)} className="p-2 text-text-muted hover:text-text-primary transition-colors">
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => { if (confirm('Excluir este módulo?')) deleteMutation.mutate(mod.id) }}
                className="p-2 text-text-muted hover:text-red-veon transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {modules.length === 0 && (
          <p className="text-center text-text-muted py-12">Nenhum módulo criado ainda.</p>
        )}
      </div>
    </div>
  )
}
