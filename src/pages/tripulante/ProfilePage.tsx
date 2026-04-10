import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useImageUpload } from '../../hooks/useImageUpload'
import { Camera, Check, User, Pencil, X } from 'lucide-react'

const BIO_MAX = 150

export function ProfilePage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const { uploadImage, uploading } = useImageUpload()

  const [form, setForm] = useState({ name: '', avatar_url: '', profession: '', bio: '' })
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)

  // Load profile
  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('name, avatar_url, profession, bio')
        .eq('id', user.id)
        .single()
      if (data) setForm({
        name: data.name || '',
        avatar_url: data.avatar_url || '',
        profession: data.profession || '',
        bio: data.bio || '',
      })
    })()
  }, [user])

  // Stats
  const { data: stats } = useQuery({
    queryKey: ['profile-stats', user?.id],
    queryFn: async () => {
      const { data: trns } = await supabase.from('trainings').select('id')
      const { data: completed } = await supabase
        .from('lesson_progress').select('lesson_id, watched_at')
        .eq('user_id', user!.id).eq('watched', true)
      const { data: views } = await supabase
        .from('lesson_views').select('viewed_at')
        .eq('user_id', user!.id)
        .order('viewed_at', { ascending: false }).limit(1)

      const lastView = views?.[0]?.viewed_at || null
      const lastProgress = completed?.length
        ? completed.sort((a: any, b: any) => new Date(b.watched_at).getTime() - new Date(a.watched_at).getTime())[0]?.watched_at
        : null
      let lastActivity: string | null = null
      if (lastView && lastProgress) lastActivity = new Date(lastView) > new Date(lastProgress) ? lastView : lastProgress
      else lastActivity = lastView || lastProgress

      return {
        trainings: trns?.length || 0,
        completed: completed?.length || 0,
        lastActivity,
      }
    },
    enabled: !!user,
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('profiles').update({
        name: form.name.trim(),
        avatar_url: form.avatar_url || null,
        profession: form.profession.trim() || null,
        bio: form.bio.trim() || null,
      }).eq('id', user!.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      setSaved(true)
      setEditing(false)
      setTimeout(() => setSaved(false), 3000)
      window.location.reload()
    },
  })

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await uploadImage(file, 'avatars')
    if (url) {
      setForm(f => ({ ...f, avatar_url: url }))
      // Auto-save avatar
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', user!.id)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  function formatLastActivity(date: string | null) {
    if (!date) return 'Nunca'
    const d = new Date(date)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'Hoje'
    if (diff === 1) return 'Ontem'
    if (diff < 7) return `${diff} dias atrás`
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Profile card — social media style */}
      <div className="bg-bg-card border border-navy-800 rounded-2xl overflow-hidden">
        {/* Cover gradient */}
        <div className="h-28 bg-gradient-to-r from-red-veon/30 via-navy-900 to-red-veon/10" />

        {/* Avatar + Edit button */}
        <div className="px-6 -mt-14 flex items-end justify-between">
          <div className="relative">
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-bg-card bg-navy-900 flex items-center justify-center">
              {form.avatar_url ? (
                <img src={form.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-text-muted" />
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-1 right-1 bg-red-veon hover:bg-red-veon-dark text-white p-2 rounded-full transition-colors shadow-lg disabled:opacity-50"
            >
              {uploading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} className="hidden" />
          </div>
          <button
            onClick={() => setEditing(!editing)}
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-colors mb-2 ${
              editing
                ? 'bg-navy-800 text-text-muted hover:text-text-primary'
                : 'bg-red-veon hover:bg-red-veon-dark text-white'
            }`}
          >
            {editing ? <><X className="w-4 h-4" /> Cancelar</> : <><Pencil className="w-4 h-4" /> Editar perfil</>}
          </button>
        </div>

        {/* Info */}
        <div className="px-6 pt-4 pb-2">
          <h1 className="text-xl font-bold text-text-primary">{form.name || 'Seu nome'}</h1>
          {form.profession && (
            <p className="text-sm text-text-muted mt-0.5">{form.profession}</p>
          )}
          {form.bio && (
            <p className="text-sm text-text-secondary mt-2 whitespace-pre-line leading-relaxed">{form.bio}</p>
          )}
          {!form.profession && !form.bio && !editing && (
            <p className="text-sm text-text-muted mt-1 italic">Clique em "Editar perfil" para adicionar sua bio</p>
          )}
        </div>

        {/* Stats bar */}
        <div className="px-6 py-4 mt-2 border-t border-navy-800 flex justify-around">
          <div className="text-center">
            <p className="text-lg font-bold text-text-primary">{stats?.trainings ?? '—'}</p>
            <p className="text-xs text-text-muted">Treinamentos</p>
          </div>
          <div className="w-px bg-navy-800" />
          <div className="text-center">
            <p className="text-lg font-bold text-text-primary">{stats?.completed ?? '—'}</p>
            <p className="text-xs text-text-muted">Concluídas</p>
          </div>
          <div className="w-px bg-navy-800" />
          <div className="text-center">
            <p className="text-sm font-semibold text-text-primary">{formatLastActivity(stats?.lastActivity ?? null)}</p>
            <p className="text-xs text-text-muted">Último acesso</p>
          </div>
        </div>
      </div>

      {/* Edit form — collapses */}
      {editing && (
        <div className="bg-bg-card border border-navy-800 rounded-2xl p-6 mt-4 space-y-5">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Editar informações</h2>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Nome</label>
            <input
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-red-veon transition-colors"
              placeholder="Seu nome completo"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Profissão</label>
            <input
              value={form.profession}
              onChange={(e) => setForm(f => ({ ...f, profession: e.target.value }))}
              className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-red-veon transition-colors"
              placeholder="Ex: Consultor de vendas"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm text-text-secondary">Bio</label>
              <span className={`text-xs ${form.bio.length >= BIO_MAX ? 'text-red-veon' : 'text-text-muted'}`}>
                {form.bio.length}/{BIO_MAX}
              </span>
            </div>
            <textarea
              value={form.bio}
              onChange={(e) => { if (e.target.value.length <= BIO_MAX) setForm(f => ({ ...f, bio: e.target.value })) }}
              className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-red-veon transition-colors resize-none"
              rows={3}
              placeholder="Conte um pouco sobre você..."
            />
          </div>

          {form.avatar_url && (
            <button
              onClick={async () => {
                setForm(f => ({ ...f, avatar_url: '' }))
                await supabase.from('profiles').update({ avatar_url: null }).eq('id', user!.id)
              }}
              className="text-xs text-text-muted hover:text-red-veon transition-colors"
            >
              Remover foto de perfil
            </button>
          )}

          <button
            onClick={() => saveMutation.mutate()}
            disabled={!form.name.trim() || saveMutation.isPending}
            className="w-full bg-red-veon hover:bg-red-veon-dark text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saveMutation.isPending ? 'Salvando...' : saved ? <><Check className="w-5 h-5" /> Salvo!</> : 'Salvar'}
          </button>

          {saveMutation.isError && (
            <p className="text-red-veon text-sm text-center">{(saveMutation.error as Error).message}</p>
          )}
        </div>
      )}

      {/* Saved toast */}
      {saved && !editing && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-green-600 text-white text-sm px-5 py-2.5 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <Check className="w-4 h-4" /> Perfil atualizado!
        </div>
      )}
    </div>
  )
}
