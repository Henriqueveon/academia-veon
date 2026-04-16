import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Save, ExternalLink, Plus, Trash2 } from 'lucide-react'
import { ImageUpload } from '../../components/ImageUpload'
import { VideoUpload } from '../../components/VideoUpload'

interface FormState {
  slug: string
  title: string
  subtitle: string
  episodes_badge: string
  published: boolean
  cta_button_text: string
  cta_button_url: string
  webhook_url: string
  objective_title: string
  objective_card1_text: string
  objective_card2_text: string
  objective_card3_text: string
  partner1_name: string
  partner1_role: string
  partner1_bio: string
  partner1_photo_url: string
  partner2_name: string
  partner2_role: string
  partner2_bio: string
  partner2_photo_url: string
}

const EMPTY: FormState = {
  slug: '', title: '', subtitle: '', episodes_badge: '3 episódios', published: false,
  cta_button_text: 'Quero saber mais', cta_button_url: '', webhook_url: '',
  objective_title: '', objective_card1_text: '', objective_card2_text: '', objective_card3_text: '',
  partner1_name: '', partner1_role: '', partner1_bio: '', partner1_photo_url: '',
  partner2_name: '', partner2_role: '', partner2_bio: '', partner2_photo_url: '',
}

export function FreeProgramEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const { data: program, isLoading } = useQuery({
    queryKey: ['gestor-free-program', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase.from('free_programs').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const { data: lessons = [] } = useQuery({
    queryKey: ['gestor-free-program-lessons', id],
    queryFn: async () => {
      if (!id) return []
      const { data, error } = await supabase
        .from('free_program_lessons')
        .select('*')
        .eq('program_id', id)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data || []
    },
    enabled: !!id,
  })

  useEffect(() => {
    if (program) {
      setForm({
        slug: program.slug || '',
        title: program.title || '',
        subtitle: program.subtitle || '',
        episodes_badge: program.episodes_badge || '',
        published: !!program.published,
        cta_button_text: program.cta_button_text || '',
        cta_button_url: program.cta_button_url || '',
        webhook_url: program.webhook_url || '',
        objective_title: program.objective_title || '',
        objective_card1_text: program.objective_card1_text || '',
        objective_card2_text: program.objective_card2_text || '',
        objective_card3_text: program.objective_card3_text || '',
        partner1_name: program.partner1_name || '',
        partner1_role: program.partner1_role || '',
        partner1_bio: program.partner1_bio || '',
        partner1_photo_url: program.partner1_photo_url || '',
        partner2_name: program.partner2_name || '',
        partner2_role: program.partner2_role || '',
        partner2_bio: program.partner2_bio || '',
        partner2_photo_url: program.partner2_photo_url || '',
      })
    }
  }, [program])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!id) return
      const { error } = await supabase
        .from('free_programs')
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      setSavedAt(Date.now())
      queryClient.invalidateQueries({ queryKey: ['gestor-free-program', id] })
      queryClient.invalidateQueries({ queryKey: ['gestor-free-programs'] })
    },
  })

  const addLessonMutation = useMutation({
    mutationFn: async () => {
      if (!id) return
      const nextOrder = (lessons[lessons.length - 1]?.sort_order ?? -1) + 1
      const { error } = await supabase
        .from('free_program_lessons')
        .insert({ program_id: id, title: 'Nova aula', sort_order: nextOrder })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gestor-free-program-lessons', id] }),
  })

  const updateLessonMutation = useMutation({
    mutationFn: async ({ lessonId, patch }: { lessonId: string; patch: any }) => {
      const { error } = await supabase.from('free_program_lessons').update(patch).eq('id', lessonId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gestor-free-program-lessons', id] }),
  })

  const deleteLessonMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      const { error } = await supabase.from('free_program_lessons').delete().eq('id', lessonId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gestor-free-program-lessons', id] }),
  })

  if (isLoading || !program) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-red-veon border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const upd = (key: keyof FormState) => (v: any) => setForm(f => ({ ...f, [key]: v }))

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {/* Sticky top */}
      <div className="sticky top-0 z-20 -mx-4 px-4 py-3 bg-bg-page/95 backdrop-blur border-b border-navy-800 flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/gestor/programas')}
          className="p-2 text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold flex-1 truncate">{form.title || 'Programa'}</h1>
        {form.slug && (
          <a
            href={`/programas/${form.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-text-secondary hover:text-red-veon px-3 py-2"
          >
            <ExternalLink className="w-4 h-4" /> Preview
          </a>
        )}
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 bg-red-veon hover:bg-red-veon-dark text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      {savedAt && (
        <p className="text-xs text-green-400 mb-4">Salvo {new Date(savedAt).toLocaleTimeString()}</p>
      )}
      {saveMutation.isError && (
        <p className="text-xs text-red-400 mb-4">Erro ao salvar: {(saveMutation.error as any)?.message}</p>
      )}

      {/* Geral */}
      <Section title="Geral">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Slug *">
            <input className={inputCls} value={form.slug} onChange={e => upd('slug')(e.target.value)} />
          </Field>
          <Field label="Título *">
            <input className={inputCls} value={form.title} onChange={e => upd('title')(e.target.value)} />
          </Field>
          <Field label="Subtítulo" full>
            <input className={inputCls} value={form.subtitle} onChange={e => upd('subtitle')(e.target.value)} />
          </Field>
          <Field label="Badge de episódios">
            <input className={inputCls} value={form.episodes_badge} onChange={e => upd('episodes_badge')(e.target.value)} />
          </Field>
          <Field label="Publicado">
            <label className="flex items-center gap-3 h-10">
              <input
                type="checkbox"
                checked={form.published}
                onChange={e => upd('published')(e.target.checked)}
                className="w-5 h-5 accent-red-veon"
              />
              <span className="text-sm text-text-secondary">{form.published ? 'Publicado (visível ao público)' : 'Rascunho'}</span>
            </label>
          </Field>
          <Field label="Texto do botão CTA">
            <input className={inputCls} value={form.cta_button_text} onChange={e => upd('cta_button_text')(e.target.value)} />
          </Field>
          <Field label="URL do botão CTA">
            <input className={inputCls} value={form.cta_button_url} onChange={e => upd('cta_button_url')(e.target.value)} placeholder="https://..." />
          </Field>
          <Field label="Webhook URL do seu CRM para este programa" full>
            <input className={inputCls} value={form.webhook_url} onChange={e => upd('webhook_url')(e.target.value)} placeholder="https://seu-crm.com/webhook/..." />
            <p className="text-xs text-text-muted mt-1">Os leads capturados serão enviados via POST para esta URL.</p>
          </Field>
        </div>
      </Section>

      {/* Objetivo */}
      <Section title="Objetivo">
        <Field label="Título da seção">
          <input className={inputCls} value={form.objective_title} onChange={e => upd('objective_title')(e.target.value)} />
        </Field>
        <p className="text-xs text-text-muted mt-3 bg-bg-card border border-navy-800 rounded-lg px-3 py-2">
          💡 Para grifar palavras em vermelho no texto dos cards, envolva entre <code className="text-red-veon font-semibold">**asteriscos duplos**</code>. Exemplo: <code>Como construir o **ápice da eficiência** em Gestão</code>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Field label="Card 1">
            <textarea rows={4} className={inputCls} value={form.objective_card1_text} onChange={e => upd('objective_card1_text')(e.target.value)} />
          </Field>
          <Field label="Card 2">
            <textarea rows={4} className={inputCls} value={form.objective_card2_text} onChange={e => upd('objective_card2_text')(e.target.value)} />
          </Field>
          <Field label="Card 3">
            <textarea rows={4} className={inputCls} value={form.objective_card3_text} onChange={e => upd('objective_card3_text')(e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* Sócios */}
      <Section title="Sócios / Fundadores">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map(n => (
            <div key={n} className="space-y-3 bg-bg-card border border-navy-800 rounded-xl p-4">
              <h3 className="font-semibold text-text-primary">Sócio {n}</h3>
              <Field label="Nome">
                <input className={inputCls}
                  value={(form as any)[`partner${n}_name`]}
                  onChange={e => upd(`partner${n}_name` as keyof FormState)(e.target.value)}
                />
              </Field>
              <Field label="Cargo / Título">
                <input className={inputCls}
                  value={(form as any)[`partner${n}_role`]}
                  onChange={e => upd(`partner${n}_role` as keyof FormState)(e.target.value)}
                />
              </Field>
              <Field label="Bio">
                <textarea rows={4} className={inputCls}
                  value={(form as any)[`partner${n}_bio`]}
                  onChange={e => upd(`partner${n}_bio` as keyof FormState)(e.target.value)}
                />
              </Field>
              <ImageUpload
                folder="programas"
                label="Foto"
                hint="Proporção recomendada 3:4"
                value={(form as any)[`partner${n}_photo_url`]}
                onChange={url => upd(`partner${n}_photo_url` as keyof FormState)(url)}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Aulas */}
      <Section title="Aulas">
        <div className="space-y-4">
          {lessons.map((l: any, idx: number) => (
            <LessonRow
              key={l.id}
              lesson={l}
              index={idx}
              onChange={(patch) => updateLessonMutation.mutate({ lessonId: l.id, patch })}
              onDelete={() => {
                if (confirm('Excluir esta aula?')) deleteLessonMutation.mutate(l.id)
              }}
            />
          ))}
          <button
            onClick={() => addLessonMutation.mutate()}
            disabled={addLessonMutation.isPending}
            className="flex items-center gap-2 bg-bg-card border border-dashed border-navy-700 hover:border-red-veon text-text-secondary hover:text-red-veon px-4 py-3 rounded-lg transition-colors w-full justify-center disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Adicionar aula
          </button>
        </div>
      </Section>
    </div>
  )
}

const inputCls =
  'w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-text-primary mb-4">{title}</h2>
      <div className="bg-bg-card border border-navy-800 rounded-xl p-5">
        {children}
      </div>
    </section>
  )
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="block text-sm text-text-secondary mb-1">{label}</label>
      {children}
    </div>
  )
}

function LessonRow({
  lesson,
  index,
  onChange,
  onDelete,
}: {
  lesson: any
  index: number
  onChange: (patch: any) => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState(lesson.title || '')
  const [subtitle, setSubtitle] = useState(lesson.subtitle || '')

  useEffect(() => {
    setTitle(lesson.title || '')
    setSubtitle(lesson.subtitle || '')
  }, [lesson.id])

  return (
    <div className="bg-bg-card border border-navy-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs text-text-muted font-mono pt-2">#{index + 1}</span>
        <button
          onClick={onDelete}
          className="p-2 text-text-muted hover:text-red-veon transition-colors"
          title="Excluir aula"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <Field label="Título">
        <input
          className={inputCls}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { if (title !== lesson.title) onChange({ title }) }}
        />
      </Field>
      <Field label="Subtítulo">
        <input
          className={inputCls}
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          onBlur={() => { if (subtitle !== lesson.subtitle) onChange({ subtitle }) }}
        />
      </Field>

      <div>
        <label className="block text-sm text-text-secondary mb-1">Vídeo (Bunny)</label>
        <VideoUpload
          currentVideoId={lesson.bunny_video_id}
          onUploadComplete={(videoId) => onChange({
            bunny_video_id: videoId,
            bunny_library_id: import.meta.env.VITE_BUNNY_LIBRARY_ID || null,
          })}
          onRemoveVideo={() => onChange({ bunny_video_id: null })}
        />
      </div>
    </div>
  )
}
