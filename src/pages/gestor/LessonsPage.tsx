import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, Play } from 'lucide-react'
import type { Lesson, Module } from '../../types/database'

export function LessonsPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Lesson | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [selectedModule, setSelectedModule] = useState<string>('')
  const [form, setForm] = useState({ module_id: '', title: '', description: '', youtube_url: '', sort_order: 0 })

  const { data: modules = [] } = useQuery({
    queryKey: ['gestor-modules'],
    queryFn: async () => {
      const { data } = await supabase.from('modules').select('*').order('sort_order')
      return data || []
    },
  })

  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ['gestor-lessons', selectedModule],
    queryFn: async () => {
      let query = supabase.from('lessons').select('*').order('sort_order')
      if (selectedModule) query = query.eq('module_id', selectedModule)
      const { data } = await query
      return data || []
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        await supabase.from('lessons').update({
          module_id: form.module_id,
          title: form.title,
          description: form.description || null,
          youtube_url: form.youtube_url,
          sort_order: form.sort_order,
        }).eq('id', editing.id)
      } else {
        await supabase.from('lessons').insert({
          module_id: form.module_id,
          title: form.title,
          description: form.description || null,
          youtube_url: form.youtube_url,
          sort_order: form.sort_order,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestor-lessons'] })
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('lessons').delete().eq('id', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestor-lessons'] })
    },
  })

  function resetForm() {
    setForm({ module_id: '', title: '', description: '', youtube_url: '', sort_order: 0 })
    setEditing(null)
    setShowForm(false)
  }

  function startEdit(lesson: Lesson) {
    setForm({
      module_id: lesson.module_id,
      title: lesson.title,
      description: lesson.description || '',
      youtube_url: lesson.youtube_url,
      sort_order: lesson.sort_order,
    })
    setEditing(lesson)
    setShowForm(true)
  }

  function getModuleName(moduleId: string) {
    return modules.find((m: Module) => m.id === moduleId)?.title || 'Sem módulo'
  }

  function extractYoutubeId(url: string): string | null {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/)
    return match ? match[1] : null
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Aulas</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-2 bg-red-veon hover:bg-red-veon-dark text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Nova Aula
        </button>
      </div>

      {/* Filter by module */}
      <div className="mb-6">
        <select
          value={selectedModule}
          onChange={(e) => setSelectedModule(e.target.value)}
          className="bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
        >
          <option value="">Todos os módulos</option>
          {modules.map((m: Module) => (
            <option key={m.id} value={m.id}>{m.title}</option>
          ))}
        </select>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-bg-card border border-navy-800 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">{editing ? 'Editar Aula' : 'Nova Aula'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Módulo *</label>
              <select
                value={form.module_id}
                onChange={(e) => setForm(f => ({ ...f, module_id: e.target.value }))}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
              >
                <option value="">Selecione...</option>
                {modules.map((m: Module) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Título *</label>
              <input
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
                placeholder="Título da aula"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">URL do YouTube *</label>
              <input
                value={form.youtube_url}
                onChange={(e) => setForm(f => ({ ...f, youtube_url: e.target.value }))}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
                placeholder="https://youtube.com/watch?v=..."
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
                placeholder="Descrição da aula"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!form.title || !form.module_id || !form.youtube_url || saveMutation.isPending}
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

      {/* Lesson list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-red-veon border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson) => {
            const videoId = extractYoutubeId(lesson.youtube_url)
            return (
              <div key={lesson.id} className="bg-bg-card border border-navy-800 rounded-xl p-4 flex items-center gap-4">
                {videoId ? (
                  <img src={`https://img.youtube.com/vi/${videoId}/default.jpg`} alt="" className="w-20 h-14 object-cover rounded" />
                ) : (
                  <div className="w-20 h-14 bg-navy-900 rounded flex items-center justify-center">
                    <Play className="w-5 h-5 text-text-muted" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-text-primary">{lesson.title}</h3>
                  <p className="text-xs text-text-muted">{getModuleName(lesson.module_id)} • Ordem: {lesson.sort_order}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(lesson)} className="p-2 text-text-muted hover:text-text-primary transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { if (confirm('Excluir esta aula?')) deleteMutation.mutate(lesson.id) }}
                    className="p-2 text-text-muted hover:text-red-veon transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
          {lessons.length === 0 && <p className="text-center text-text-muted py-12">Nenhuma aula criada ainda.</p>}
        </div>
      )}
    </div>
  )
}
