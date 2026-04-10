import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, BookOpen, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { ImageUpload } from '../../components/ImageUpload'

export function TrainingsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ title: '', description: '', thumbnail_url: '', sort_order: 0, visibility: 'oculto', fake_students_count: '' as string | number })

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
      const payload = {
        title: form.title,
        description: form.description || null,
        thumbnail_url: form.thumbnail_url || null,
        sort_order: form.sort_order,
        visibility: form.visibility,
        fake_students_count: form.fake_students_count !== '' ? Number(form.fake_students_count) : null,
      }
      if (editing) {
        await supabase.from('trainings').update(payload).eq('id', editing.id)
      } else {
        await supabase.from('trainings').insert(payload)
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
    setForm({ title: '', description: '', thumbnail_url: '', sort_order: 0, visibility: 'oculto', fake_students_count: '' })
    setEditing(null)
    setShowForm(false)
  }

  function startEdit(t: any) {
    setForm({ title: t.title, description: t.description || '', thumbnail_url: t.thumbnail_url || '', sort_order: t.sort_order, visibility: t.visibility || 'oculto', fake_students_count: t.fake_students_count ?? '' })
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm text-text-secondary mb-1">Descrição</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
                rows={2}
                placeholder="Descrição do treinamento"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Visibilidade</label>
              <select
                value={form.visibility}
                onChange={(e) => setForm(f => ({ ...f, visibility: e.target.value }))}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
              >
                <option value="oculto">Oculto — Só quem tem acesso vê</option>
                <option value="vitrine">Vitrine — Todos veem (com cadeado se sem acesso)</option>
              </select>
            </div>
            {form.visibility === 'vitrine' && (
              <div>
                <label className="block text-sm text-text-secondary mb-1">Qtd. alunos (vitrine)</label>
                <input
                  type="number"
                  value={form.fake_students_count}
                  onChange={(e) => setForm(f => ({ ...f, fake_students_count: e.target.value }))}
                  className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
                  placeholder="Ex: 250 (deixe vazio para contar real)"
                />
                <p className="text-xs text-text-muted mt-1">Se preenchido, mostra esse número ao invés do real.</p>
              </div>
            )}
            <div className="col-span-1 md:col-span-2">
              <ImageUpload
                value={form.thumbnail_url}
                onChange={(url) => setForm(f => ({ ...f, thumbnail_url: url }))}
                folder="treinamentos"
                label="Capa do Treinamento"
                hint="1280 x 720 px (16:9)"
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
                className="bg-bg-card border border-navy-800 rounded-xl overflow-hidden hover:border-navy-600 transition-colors group"
              >
                <div className="cursor-pointer" onClick={() => navigate(`/gestor/treinamentos/${t.id}`)}>
                  {t.thumbnail_url ? (
                    <img src={t.thumbnail_url} alt={t.title} className="w-full h-40 object-cover" />
                  ) : (
                    <div className="w-full h-40 bg-navy-900 flex items-center justify-center">
                      <BookOpen className="w-12 h-12 text-navy-700" />
                    </div>
                  )}
                  <div className="px-5 pt-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-text-primary text-lg">{t.title}</h3>
                        {t.description && (
                          <p className="text-sm text-text-muted mt-1 line-clamp-2">{t.description}</p>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-red-veon transition-colors flex-shrink-0 mt-1" />
                    </div>
                  </div>
                </div>
                <div className="px-5 pb-5">
                  <div className="flex items-center gap-4 mt-3 text-xs text-text-muted">
                    <span>{modCount} módulo(s)</span>
                    <span>{lessonCount} aula(s)</span>
                    <span className={`flex items-center gap-1 ${t.visibility === 'vitrine' ? 'text-yellow-400' : ''}`}>
                      {t.visibility === 'vitrine' ? <><Eye className="w-3 h-3" /> Vitrine</> : <><EyeOff className="w-3 h-3" /> Oculto</>}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => startEdit(t)}
                      className="flex items-center gap-1.5 text-xs bg-navy-800 hover:bg-navy-700 text-text-secondary hover:text-text-primary px-3 py-2 rounded-lg transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => { if (confirm('Excluir este treinamento e tudo dentro?')) deleteMutation.mutate(t.id) }}
                      className="flex items-center gap-1.5 text-xs bg-navy-800 hover:bg-red-900/50 text-text-secondary hover:text-red-veon px-3 py-2 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
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
