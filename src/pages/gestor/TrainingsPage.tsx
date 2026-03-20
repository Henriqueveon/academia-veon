import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, BookOpen, ChevronRight } from 'lucide-react'

export function TrainingsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ title: '', description: '', thumbnail_url: '', sort_order: 0 })

  const { data: trainings = [], isLoading } = useQuery({
    queryKey: ['gestor-trainings'],
    queryFn: async () => {
      const { data } = await supabase.from('trainings').select('*').order('sort_order')
      return data || []
    },
  })

  const { data: modules = [] } = useQuery({
    queryKey: ['gestor-modules'],
    queryFn: async () => {
      const { data } = await supabase.from('modules').select('id, training_id')
      return data || []
    },
  })

  const { data: lessons = [] } = useQuery({
    queryKey: ['gestor-lessons-count'],
    queryFn: async () => {
      const { data } = await supabase.from('lessons').select('id, module_id')
      return data || []
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        await supabase.from('trainings').update({
          title: form.title,
          description: form.description || null,
          thumbnail_url: form.thumbnail_url || null,
          sort_order: form.sort_order,
        }).eq('id', editing.id)
      } else {
        await supabase.from('trainings').insert({
          title: form.title,
          description: form.description || null,
          thumbnail_url: form.thumbnail_url || null,
          sort_order: form.sort_order,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestor-trainings'] })
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('trainings').delete().eq('id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gestor-trainings'] }),
  })

  function resetForm() {
    setForm({ title: '', description: '', thumbnail_url: '', sort_order: 0 })
    setEditing(null)
    setShowForm(false)
  }

  function startEdit(t: any, e: React.MouseEvent) {
    e.stopPropagation()
    setForm({ title: t.title, description: t.description || '', thumbnail_url: t.thumbnail_url || '', sort_order: t.sort_order })
    setEditing(t)
    setShowForm(true)
  }

  function getModuleCount(trainingId: string) {
    return modules.filter((m: any) => m.training_id === trainingId).length
  }

  function getLessonCount(trainingId: string) {
    const modIds = modules.filter((m: any) => m.training_id === trainingId).map((m: any) => m.id)
    return lessons.filter((l: any) => modIds.includes(l.module_id)).length
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
        <h1 className="text-2xl font-bold">Treinamentos</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-2 bg-red-veon hover:bg-red-veon-dark text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo Treinamento
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-bg-card border border-navy-800 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">{editing ? 'Editar Treinamento' : 'Novo Treinamento'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Título *</label>
              <input
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
                placeholder="Ex: Vendas pelo WhatsApp"
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
                rows={2}
                placeholder="Descrição do treinamento"
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
            <button onClick={resetForm} className="bg-bg-input text-text-secondary hover:text-text-primary px-6 py-2 rounded-lg transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Training cards */}
      {trainings.length === 0 ? (
        <p className="text-center text-text-muted py-20">Nenhum treinamento criado ainda.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trainings.map((t: any) => {
            const modCount = getModuleCount(t.id)
            const lessonCount = getLessonCount(t.id)
            return (
              <div
                key={t.id}
                onClick={() => navigate(`/gestor/treinamentos/${t.id}`)}
                className="bg-bg-card border border-navy-800 rounded-xl overflow-hidden hover:border-navy-600 transition-colors cursor-pointer group"
              >
                {t.thumbnail_url ? (
                  <img src={t.thumbnail_url} alt={t.title} className="w-full h-40 object-cover" />
                ) : (
                  <div className="w-full h-40 bg-navy-900 flex items-center justify-center">
                    <BookOpen className="w-12 h-12 text-navy-700" />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-text-primary text-lg">{t.title}</h3>
                      {t.description && (
                        <p className="text-sm text-text-muted mt-1 line-clamp-2">{t.description}</p>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-red-veon transition-colors flex-shrink-0 mt-1" />
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-text-muted">
                    <span>{modCount} módulo(s)</span>
                    <span>{lessonCount} aula(s)</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={(e) => startEdit(t, e)}
                      className="p-1.5 text-text-muted hover:text-text-primary transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (confirm('Excluir este treinamento e tudo dentro?')) deleteMutation.mutate(t.id) }}
                      className="p-1.5 text-text-muted hover:text-red-veon transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
