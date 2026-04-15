import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Wallet, Copy, Check, Share2, Gift, ArrowDownCircle, ArrowUpCircle, BookOpen, X, Sparkles } from 'lucide-react'

export function CreditsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [showRedeem, setShowRedeem] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<string>('')

  const referralLink = user ? `${window.location.origin}/cadastro?ref=${user.id}` : ''

  // Valor do bônus por indicação (configurado pelo gestor)
  const { data: creditSettings } = useQuery({
    queryKey: ['credit-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('credit_settings').select('referral_amount').eq('id', 1).maybeSingle()
      return data
    },
  })
  const referralBonus = Number(creditSettings?.referral_amount ?? 2)
  const formatBRL = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`

  // Saldo
  const { data: credit } = useQuery({
    queryKey: ['credit', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('credits').select('*').eq('user_id', user!.id).maybeSingle()
      return data || { balance: 0 }
    },
    enabled: !!user,
  })

  // Histórico
  const { data: transactions = [] } = useQuery({
    queryKey: ['credit-transactions', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50)
      return data || []
    },
    enabled: !!user,
  })

  // Lista de cadastros feitos pelo seu link
  const { data: referrals = [] } = useQuery({
    queryKey: ['my-referrals', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, created_at')
        .eq('referred_by', user!.id)
        .order('created_at', { ascending: false })
      return data || []
    },
    enabled: !!user,
  })
  const referralsCount = referrals.length

  // Cursos disponíveis para resgate (com preço definido)
  const { data: redeemableCourses = [] } = useQuery({
    queryKey: ['redeemable-courses'],
    queryFn: async () => {
      const { data } = await supabase
        .from('trainings')
        .select('id, title, credit_price, thumbnail_url')
        .not('credit_price', 'is', null)
        .order('credit_price')
      return data || []
    },
  })

  // Solicitar resgate
  const redeemMutation = useMutation({
    mutationFn: async () => {
      const course = redeemableCourses.find((c: any) => c.id === selectedCourse)
      if (!course) throw new Error('Curso inválido')
      const { error } = await supabase.from('redemption_requests').insert({
        user_id: user!.id,
        course_id: course.id,
        amount: course.credit_price,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit'] })
      setShowRedeem(false)
      setSelectedCourse('')
      alert('Solicitação enviada! O gestor irá revisar e liberar o curso em breve.')
    },
  })

  function copyReferralLink() {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function shareReferralLink() {
    const text = `Conhece a Academia Veon? Entra com o meu link: ${referralLink}`
    if (navigator.share) {
      navigator.share({ title: 'Academia Veon', text, url: referralLink }).catch(() => {})
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    }
  }

  const balance = Number(credit?.balance || 0)

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-3">
        <Wallet className="w-7 h-7 text-red-veon" />
        Meus Créditos
      </h1>

      {/* Saldo principal */}
      <div className="bg-gradient-to-br from-red-veon to-red-veon-dark rounded-3xl p-6 mb-6 text-white shadow-xl">
        <p className="text-sm text-white/80 mb-1">Saldo disponível</p>
        <p className="text-4xl font-bold mb-4">
          R$ {balance.toFixed(2).replace('.', ',')}
        </p>
        <button
          onClick={() => setShowRedeem(true)}
          disabled={balance <= 0}
          className="w-full bg-white text-red-veon font-semibold py-3 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Gift className="w-5 h-5" /> Resgatar por curso
        </button>
      </div>

      {/* Card de indicação */}
      <div className="bg-bg-card border border-navy-800 rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h2 className="font-semibold text-text-primary">Indique amigos e ganhe</h2>
            <p className="text-xs text-text-muted">{formatBRL(referralBonus)} por cada cadastro novo</p>
          </div>
        </div>

        <div className="bg-bg-input rounded-lg p-2 flex items-center gap-2 mb-3">
          <code className="text-xs text-text-secondary truncate flex-1">{referralLink}</code>
          <button
            onClick={copyReferralLink}
            className="bg-navy-800 hover:bg-navy-700 p-2 rounded-lg flex-shrink-0"
            title="Copiar"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-text-muted" />}
          </button>
        </div>

        <button
          onClick={shareReferralLink}
          className="w-full bg-red-veon hover:bg-red-veon-dark text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2"
        >
          <Share2 className="w-4 h-4" /> Compartilhar meu link
        </button>

        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-navy-800">
          <div className="text-center">
            <p className="text-2xl font-bold text-text-primary">{referralsCount}</p>
            <p className="text-xs text-text-muted">indicações</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">
              {formatBRL(referralsCount * referralBonus)}
            </p>
            <p className="text-xs text-text-muted">ganhos por indicação</p>
          </div>
        </div>

        {referrals.length > 0 && (
          <div className="mt-4 pt-4 border-t border-navy-800">
            <p className="text-xs text-text-muted mb-2">Alunos que você indicou</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {referrals.map((r: any) => (
                <div key={r.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-navy-900 flex items-center justify-center flex-shrink-0">
                    {r.avatar_url ? (
                      <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-text-muted font-semibold">
                        {r.name?.trim().charAt(0).toUpperCase() || '?'}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{r.name}</p>
                    <p className="text-xs text-text-muted">
                      {new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-green-400 flex-shrink-0">+{formatBRL(referralBonus)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Como funciona */}
      <div className="bg-bg-card border border-navy-800 rounded-2xl p-5 mb-6">
        <h2 className="font-semibold text-text-primary mb-3">Como funciona</h2>
        <div className="space-y-3 text-sm text-text-secondary">
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-red-veon/20 text-red-veon font-bold flex items-center justify-center flex-shrink-0">1</div>
            <p>Compartilhe qualquer post do feed ou seu link de indicação com amigos</p>
          </div>
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-red-veon/20 text-red-veon font-bold flex items-center justify-center flex-shrink-0">2</div>
            <p>Quando alguém se cadastrar pelo seu link, você ganha <strong className="text-text-primary">créditos</strong> automáticos</p>
          </div>
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-red-veon/20 text-red-veon font-bold flex items-center justify-center flex-shrink-0">3</div>
            <p>Acumule créditos e troque por <strong className="text-text-primary">cursos exclusivos</strong> da Academia</p>
          </div>
        </div>
      </div>

      {/* Histórico */}
      <div className="bg-bg-card border border-navy-800 rounded-2xl p-5">
        <h2 className="font-semibold text-text-primary mb-3">Histórico</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-6">Nenhuma transação ainda</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((t: any) => {
              const isPositive = Number(t.amount) > 0
              return (
                <div key={t.id} className="flex items-center gap-3 py-2">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isPositive ? 'bg-green-900/30' : 'bg-red-900/30'
                  }`}>
                    {isPositive ? (
                      <ArrowDownCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <ArrowUpCircle className="w-5 h-5 text-red-veon" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">
                      {t.description || (t.type === 'referral' ? 'Indicação' : t.type === 'manual_add' ? 'Crédito adicionado' : t.type === 'redemption_course' ? 'Resgate de curso' : 'Transação')}
                    </p>
                    <p className="text-xs text-text-muted">
                      {new Date(t.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <p className={`text-sm font-semibold ${isPositive ? 'text-green-400' : 'text-red-veon'}`}>
                    {isPositive ? '+' : ''}R$ {Math.abs(Number(t.amount)).toFixed(2).replace('.', ',')}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de resgate */}
      {showRedeem && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setShowRedeem(false)}>
          <div className="bg-bg-card border border-navy-800 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-navy-800">
              <h2 className="text-lg font-semibold">Resgatar curso</h2>
              <button onClick={() => setShowRedeem(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              <p className="text-sm text-text-muted mb-4">
                Seu saldo: <strong className="text-text-primary">R$ {balance.toFixed(2).replace('.', ',')}</strong>
              </p>

              {redeemableCourses.length === 0 ? (
                <div className="text-center py-8 text-text-muted">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhum curso disponível para resgate no momento</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {redeemableCourses.map((c: any) => {
                    const canAfford = balance >= Number(c.credit_price)
                    const isSelected = selectedCourse === c.id
                    return (
                      <button
                        key={c.id}
                        onClick={() => canAfford && setSelectedCourse(c.id)}
                        disabled={!canAfford}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                          isSelected ? 'border-red-veon bg-red-veon/10' :
                          canAfford ? 'border-navy-800 hover:border-navy-600' : 'border-navy-800 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        {c.thumbnail_url ? (
                          <img src={c.thumbnail_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-navy-900 flex items-center justify-center flex-shrink-0">
                            <BookOpen className="w-6 h-6 text-text-muted" />
                          </div>
                        )}
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-medium text-text-primary truncate">{c.title}</p>
                          <p className="text-sm text-red-veon font-semibold">
                            R$ {Number(c.credit_price).toFixed(2).replace('.', ',')}
                          </p>
                        </div>
                        {!canAfford && (
                          <span className="text-xs text-text-muted">Saldo insuficiente</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {redeemableCourses.length > 0 && (
              <div className="p-4 border-t border-navy-800 flex gap-2">
                <button onClick={() => setShowRedeem(false)} className="flex-1 bg-bg-input text-text-secondary py-2.5 rounded-lg text-sm">
                  Cancelar
                </button>
                <button
                  onClick={() => redeemMutation.mutate()}
                  disabled={!selectedCourse || redeemMutation.isPending}
                  className="flex-1 bg-red-veon hover:bg-red-veon-dark text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {redeemMutation.isPending ? 'Enviando...' : 'Solicitar resgate'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
