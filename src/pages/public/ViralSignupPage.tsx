import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export function ViralSignupPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    whatsapp: '',
    email: '',
    emailConfirm: '',
    password: '',
    passwordConfirm: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [referralId, setReferralId] = useState<string | null>(null)

  useEffect(() => {
    // Prioriza ?ref= da URL (link direto de indicação da CreditsPage);
    // fallback para localStorage (setado por PublicPostPage quando aluno compartilha um post).
    const params = new URLSearchParams(window.location.search)
    const urlRef = params.get('ref')
    if (urlRef) {
      localStorage.setItem('referral_id', urlRef)
      setReferralId(urlRef)
      return
    }
    const ref = localStorage.getItem('referral_id')
    setReferralId(ref)
  }, [])

  function formatWhatsApp(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 2) return digits
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  function validate(): string | null {
    if (!form.name.trim()) return 'Preencha o nome completo'
    if (form.name.trim().split(' ').length < 2) return 'Informe nome e sobrenome'
    if (!form.whatsapp.trim()) return 'Preencha o WhatsApp'
    if (form.whatsapp.replace(/\D/g, '').length < 10) return 'WhatsApp inválido'
    if (!form.email.trim()) return 'Preencha o email'
    if (form.email !== form.emailConfirm) return 'Os emails não coincidem'
    if (form.password.length < 6) return 'A senha deve ter no mínimo 6 caracteres'
    if (form.password !== form.passwordConfirm) return 'As senhas não coincidem'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)

    const metadata: any = {
      name: form.name.trim(),
      whatsapp: form.whatsapp.replace(/\D/g, ''),
      viral_signup: true,
    }
    if (referralId) {
      metadata.referred_by = referralId
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      options: { data: metadata },
    })

    if (signUpError) {
      const msg = signUpError.message
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        setError('Este email já está cadastrado. Faça login.')
      } else {
        setError(msg || 'Erro ao criar conta. Tente novamente.')
      }
      setSubmitting(false)
      return
    }

    // Auto-confirm email via service for viral signups
    if (data.user) {
      try {
        await supabase.rpc('admin_confirm_user_email', { target_user_id: data.user.id })
      } catch {}
    }

    // Clear referral
    localStorage.removeItem('referral_id')

    setSuccess(true)

    // Sign in automatically
    setTimeout(async () => {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      })
      if (!signInError) {
        navigate('/comunidade')
      } else {
        navigate('/login')
      }
    }, 1500)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-text-primary mb-2">Bem-vindo à Academia Veon!</h1>
          <p className="text-text-muted">Entrando na sua conta...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <GraduationCap className="w-12 h-12 text-red-veon mx-auto mb-3" />
          <h1 className="text-3xl font-bold text-text-primary">Academia Veon</h1>
          <p className="text-text-muted mt-1">Crie sua conta gratuita</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-bg-card border border-navy-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Nome completo *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              required
              className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-red-veon"
              placeholder="Seu nome completo"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">WhatsApp *</label>
            <input
              type="text"
              value={form.whatsapp}
              onChange={(e) => setForm(f => ({ ...f, whatsapp: formatWhatsApp(e.target.value) }))}
              required
              className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-red-veon"
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                required
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-red-veon"
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Confirme *</label>
              <input
                type="email"
                value={form.emailConfirm}
                onChange={(e) => setForm(f => ({ ...f, emailConfirm: e.target.value }))}
                required
                onPaste={(e) => e.preventDefault()}
                className={`w-full bg-bg-input border rounded-lg px-4 py-3 text-text-primary focus:outline-none ${
                  form.emailConfirm && form.email !== form.emailConfirm ? 'border-red-veon' : 'border-navy-700 focus:border-red-veon'
                }`}
                placeholder="Repita o email"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Senha *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  minLength={6}
                  className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-red-veon pr-12"
                  placeholder="Mín. 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Confirme *</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.passwordConfirm}
                onChange={(e) => setForm(f => ({ ...f, passwordConfirm: e.target.value }))}
                required
                onPaste={(e) => e.preventDefault()}
                className={`w-full bg-bg-input border rounded-lg px-4 py-3 text-text-primary focus:outline-none ${
                  form.passwordConfirm && form.password !== form.passwordConfirm ? 'border-red-veon' : 'border-navy-700 focus:border-red-veon'
                }`}
                placeholder="Repita a senha"
              />
            </div>
          </div>

          {error && <p className="text-red-veon text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-red-veon hover:bg-red-veon-dark text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? 'Criando conta...' : 'Criar minha conta'}
          </button>

          <p className="text-center text-xs text-text-muted">
            Já tem conta?{' '}
            <button type="button" onClick={() => navigate('/login')} className="text-red-veon hover:text-red-veon-dark">
              Fazer login
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
