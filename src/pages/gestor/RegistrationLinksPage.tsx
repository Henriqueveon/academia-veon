import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, Link2, Copy, Check, Trash2, Power, PowerOff, Users, BookOpen } from 'lucide-react'

export function RegistrationLinksPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [description, setDescription] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['gestor-registration-links'],
    queryFn: async () => {
      const { data } = await supabase
        .from('registration_links')
        .select('*')
        .order('created_at', { ascending: false })
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

  function generateSlug() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  function getTrainingsForGroup(groupId: string) {
    const trainingIds = trainingGroups
      .filter((tg: any) => tg.group_id === groupId)
      .map((tg: any) => tg.training_id)
    return trainings.filter((t: any) => trainingIds.includes(t.id))
  }

  function getGroupName(groupId: string) {
    return groups.find((g: any) => g.id === groupId)?.name || '—'
  }

  function getLinkUrl(slug: string) {
    return `${window.location.origin}/cadastro/${slug}`
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const slug = generateSlug()
      const { error } = await supabase.from('registration_links').insert({
        slug,
        group_id: selectedGroupId,
        description: description || null,
        created_by: user?.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestor-registration-links'] })
      setShowForm(false)
      setDescription('')
      setSelectedGroupId('')
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await supabase.from('registration_links').update({ active }).eq('id', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestor-registration-links'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('registration_links').delete().eq('id', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestor-registration-links'] })
    },
  })

  function copyLink(slug: string) {
    navigator.clipboard.writeText(getLinkUrl(slug))
    setCopiedSlug(slug)
    setTimeout(() => setCopiedSlug(null), 2000)
  }

  const selectedGroupTrainings = selectedGroupId ? getTrainingsForGroup(selectedGroupId) : []

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Link2 className="w-7 h-7 text-red-veon" />
            Links de Cadastro
          </h1>
          <p className="text-text-secondary mt-2">Crie links para autocadastro de tripulantes.</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setDescription(''); setSelectedGroupId('') }}
          className="flex items-center gap-2 bg-red-veon hover:bg-red-veon-dark text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo Link
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-bg-card border border-navy-800 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Novo Link de Cadastro</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Descrição (opcional)</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
                placeholder="Ex: Link para equipe de vendas"
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1">Turma *</label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
              >
                <option value="">Selecione a turma...</option>
                {groups.map((g: any) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <p className="text-xs text-text-muted mt-1">
                Ao se cadastrar, o tripulante será adicionado a esta turma automaticamente.
              </p>
            </div>

            {/* Preview: trainings the group has access to */}
            {selectedGroupId && (
              <div className="bg-bg-secondary border border-navy-700 rounded-lg p-4">
                <p className="text-sm text-text-secondary mb-2 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Treinamentos que esta turma tem acesso:
                </p>
                {selectedGroupTrainings.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedGroupTrainings.map((t: any) => (
                      <span key={t.id} className="text-xs bg-green-900/30 text-green-400 border border-green-800 px-2.5 py-1 rounded-lg">
                        {t.title}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">
                    Nenhum treinamento liberado para esta turma. Configure em Liberações.
                  </p>
                )}
              </div>
            )}
          </div>

          {createMutation.isError && (
            <p className="text-red-veon text-sm mt-3">{(createMutation.error as Error).message}</p>
          )}

          <div className="flex gap-3 mt-5">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!selectedGroupId || createMutation.isPending}
              className="bg-red-veon hover:bg-red-veon-dark text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Criando...' : 'Criar Link'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="bg-bg-input text-text-secondary hover:text-text-primary px-6 py-2 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Links list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-red-veon border-t-transparent rounded-full animate-spin" />
        </div>
      ) : links.length === 0 ? (
        <div className="text-center py-20 text-text-muted">
          <Link2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Nenhum link de cadastro criado ainda.</p>
          <p className="text-sm mt-1">Crie um link para permitir que tripulantes se cadastrem sozinhos.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {links.map((link: any) => {
            const groupTrainings = getTrainingsForGroup(link.group_id)
            const isCopied = copiedSlug === link.slug

            return (
              <div
                key={link.id}
                className={`bg-bg-card border rounded-xl p-5 ${
                  link.active ? 'border-navy-800' : 'border-navy-800/50 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Description */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full ${link.active ? 'bg-green-500' : 'bg-navy-600'}`} />
                      <h3 className="font-medium text-text-primary">
                        {link.description || 'Link de cadastro'}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        link.active ? 'bg-green-900/30 text-green-400' : 'bg-navy-800 text-text-muted'
                      }`}>
                        {link.active ? 'Ativo' : 'Desativado'}
                      </span>
                    </div>

                    {/* Link URL */}
                    <div className="flex items-center gap-2 mb-3">
                      <code className="text-xs bg-bg-input px-3 py-1.5 rounded-lg text-text-secondary truncate block flex-1">
                        {getLinkUrl(link.slug)}
                      </code>
                      <button
                        onClick={() => copyLink(link.slug)}
                        className="flex items-center gap-1.5 text-xs bg-navy-800 hover:bg-navy-700 text-text-secondary px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {isCopied ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>

                    {/* Group & trainings info */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        Turma: <span className="text-text-secondary">{getGroupName(link.group_id)}</span>
                      </span>
                      {groupTrainings.length > 0 && (
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5" />
                          Acesso:
                          {groupTrainings.map((t: any) => (
                            <span key={t.id} className="bg-navy-800 px-1.5 py-0.5 rounded text-text-muted">
                              {t.title}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleMutation.mutate({ id: link.id, active: !link.active })}
                      className={`p-2 transition-colors ${
                        link.active ? 'text-green-400 hover:text-yellow-400' : 'text-text-muted hover:text-green-400'
                      }`}
                      title={link.active ? 'Desativar link' : 'Ativar link'}
                    >
                      {link.active ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Excluir este link de cadastro?')) deleteMutation.mutate(link.id)
                      }}
                      className="p-2 text-text-muted hover:text-red-veon transition-colors"
                      title="Excluir link"
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
