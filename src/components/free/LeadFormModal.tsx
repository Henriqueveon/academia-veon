import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'

interface LeadData {
  nome: string
  whatsapp: string
  email: string
  instagram: string
}

interface LeadFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: LeadData) => void
  webhookUrl?: string | null
  programSlug: string
  programTitle?: string
  buttonText?: string | null
}

export function LeadFormModal({ open, onClose, onSubmit, webhookUrl, programSlug, programTitle, buttonText }: LeadFormModalProps) {
  const [data, setData] = useState<LeadData>({ nome: '', whatsapp: '', email: '', instagram: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!data.nome || !data.whatsapp || !data.email) {
      setError('Preencha nome, WhatsApp e e-mail.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/webhooks/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl, data, programSlug }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.ok === false) {
        // Ainda libera o usuário mesmo se o webhook falhar, mas loga
        console.warn('Webhook falhou:', json.error)
      }
      onSubmit(data)
    } catch (err) {
      console.error(err)
      // Libera mesmo em erro de rede para não bloquear UX
      onSubmit(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[#0F1F42] border-2 border-[#E63946] rounded-2xl p-6 md:p-8 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-[#B8C0D0] hover:text-white p-1"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl md:text-2xl font-bold text-white mb-1 pr-6">
          Preencha para desbloquear suas aulas
        </h2>
        {programTitle && (
          <p className="text-sm text-[#B8C0D0] mb-5">
            {programTitle.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
              part.startsWith('**') && part.endsWith('**')
                ? <span key={i} className="text-[#E63946] font-bold">{part.slice(2, -2)}</span>
                : <span key={i}>{part}</span>
            )}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-[#B8C0D0] mb-1">Nome *</label>
            <input
              value={data.nome}
              onChange={(e) => setData(d => ({ ...d, nome: e.target.value }))}
              className="w-full bg-[#0A1733] border border-[#E63946]/40 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#E63946]"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-[#B8C0D0] mb-1">WhatsApp *</label>
            <input
              value={data.whatsapp}
              onChange={(e) => setData(d => ({ ...d, whatsapp: e.target.value }))}
              placeholder="(11) 99999-9999"
              className="w-full bg-[#0A1733] border border-[#E63946]/40 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#E63946]"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-[#B8C0D0] mb-1">E-mail *</label>
            <input
              type="email"
              value={data.email}
              onChange={(e) => setData(d => ({ ...d, email: e.target.value }))}
              className="w-full bg-[#0A1733] border border-[#E63946]/40 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#E63946]"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-[#B8C0D0] mb-1">Instagram</label>
            <input
              value={data.instagram}
              onChange={(e) => setData(d => ({ ...d, instagram: e.target.value }))}
              placeholder="@seuinsta"
              className="w-full bg-[#0A1733] border border-[#E63946]/40 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#E63946]"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#E63946] hover:bg-[#c62f3b] text-white font-semibold px-5 py-3 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {buttonText?.trim() || 'Desbloquear aulas'}
          </button>
        </form>
      </div>
    </div>
  )
}
