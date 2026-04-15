import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Wallet, Save, Check } from 'lucide-react'

export function CreditSettingsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('')
  const [saved, setSaved] = useState(false)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['credit-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('credit_settings').select('*').eq('id', 1).maybeSingle()
      return data
    },
  })

  useEffect(() => {
    if (settings?.referral_amount != null) {
      setAmount(String(settings.referral_amount).replace('.', ','))
    }
  }, [settings])

  const save = useMutation({
    mutationFn: async () => {
      const normalized = amount.replace(',', '.').trim()
      const value = Number(normalized)
      if (!Number.isFinite(value) || value < 0) throw new Error('Valor inválido')
      const { error } = await supabase
        .from('credit_settings')
        .update({ referral_amount: value, updated_at: new Date().toISOString(), updated_by: user?.id })
        .eq('id', 1)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
    onError: (err) => {
      alert(err instanceof Error ? err.message : 'Erro ao salvar')
    },
  })

  const current = Number(settings?.referral_amount || 0)

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
        <Wallet className="w-7 h-7 text-red-veon" />
        Gestão de Créditos
      </h1>
      <p className="text-sm text-text-muted mb-6">
        Configure quanto cada aluno ganha quando indica uma nova pessoa que se cadastra na plataforma.
      </p>

      <div className="bg-bg-card border border-navy-800 rounded-2xl p-6">
        <h2 className="font-semibold text-text-primary mb-1">Bônus por indicação</h2>
        <p className="text-xs text-text-muted mb-4">
          Valor atual: <strong className="text-text-primary">R$ {current.toFixed(2).replace('.', ',')}</strong>
        </p>

        <label className="block text-sm text-text-secondary mb-1.5">Novo valor por indicação (R$)</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">R$</span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
              disabled={isLoading}
              className="w-full bg-bg-input border border-navy-700 rounded-lg pl-10 pr-3 py-2.5 text-text-primary focus:outline-none focus:border-red-veon"
              placeholder="0,00"
            />
          </div>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || isLoading}
            className="bg-red-veon hover:bg-red-veon-dark text-white font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {save.isPending ? 'Salvando...' : saved ? 'Salvo' : 'Salvar'}
          </button>
        </div>

        <p className="mt-3 text-xs text-text-muted">
          O novo valor passa a valer para todas as indicações criadas a partir da alteração. Indicações anteriores mantêm o valor que tinham na época.
        </p>
      </div>
    </div>
  )
}
