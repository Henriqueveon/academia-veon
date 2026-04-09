import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { GraduationCap, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export function RegisterPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const [linkInfo, setLinkInfo] = useState<{ group_name: string; description: string | null } | null>(null)
  const [linkError, setLinkError] = useState(false)
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({
    name: '',
    cpf: '',
    email: '',
    emailConfirm: '',
    whatsapp: '',
    password: '',
    passwordConfirm: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // Validate the link on mount
  useEffect(() => {
    async function validateLink() {
      if (!slug) { setLinkError(true); setLoading(false); return }

      const { data: link } = await supabase
        .from('registration_links')
        .select('group_id, description')
        .eq('slug', slug)
        .eq('active', true)
        .single()

      if (!link) {
        setLinkError(true)
        setLoading(false)
        return
      }

      // Get group name for display
      const { data: group } = await supabase
        .from('groups')
        .select('name')
        .eq('id', link.group_id)
        .single()

      setLinkInfo({
        group_name: group?.name || '',
        description: link.description,
      })
      setLoading(false)
    }
    validateLink()
  }, [slug])

  function formatCPF(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
  }

  function formatWhatsApp(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 2) return digits
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  function validate(): string | null {
    if (!form.name.trim()) return 'Preencha o nome completo'
    if (form.name.trim().split(' ').length < 2) return 'Informe nome e sobrenome'
    if (form.cpf.replace(/\D/g, '').length !== 11) return 'CPF deve ter 11 dígitos'
    if (!form.email.trim()) return 'Preencha o email'
    if (form.email !== form.emailConfirm) return 'Os emails não coincidem'
    if (!form.whatsapp.trim()) return 'Preencha o WhatsApp'
    if (form.whatsapp.replace(/\D/g, '').length < 10) return 'WhatsApp inválido'
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

    // Usar signUp nativo do Supabase (sempre funciona sem auth)
    // O trigger handle_new_user cuida de criar o perfil e vincular à turma
    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      options: {
        data: {
          name: form.name.trim(),
          cpf: form.cpf.replace(/\D/g, ''),
          whatsapp: form.whatsapp.replace(/\D/g, ''),
          registration_slug: slug,
        },
      },
    })

    if (signUpError) {
      const msg = signUpError.message
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        setError('Este email já está cadastrado. Faça login ou use outro email.')
      } else {
        setError(msg || 'Erro ao criar conta. Tente novamente.')
      }
      setSubmitting(false)
      return
    }

    // Deslogar (o tripulante vai fazer login manualmente)
    await supabase.auth.signOut()

    setSuccess(true)
    setSubmitting(false)

    // Redirect to login after 3 seconds
    setTimeout(() => navigate('/login'), 3000)
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-veon border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Invalid link
  if (linkError) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <GraduationCap className="w-12 h-12 text-red-veon mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-text-primary mb-2">Link Inválido</h1>
          <p className="text-text-muted mb-6">
            Este link de cadastro não existe ou foi desativado.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="text-red-veon hover:text-red-veon-dark transition-colors text-sm"
          >
            Ir para o login
          </button>
        </div>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-text-primary mb-2">Cadastro realizado!</h1>
          <p className="text-text-muted mb-2">
            Sua conta foi criada com sucesso.
          </p>
          <p className="text-text-secondary text-sm mb-6">
            Redirecionando para o login...
          </p>
          <button
            onClick={() => navigate('/login')}
            className="bg-red-veon hover:bg-red-veon-dark text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Ir para o Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <GraduationCap className="w-12 h-12 text-red-veon mx-auto mb-3" />
          <h1 className="text-3xl font-bold text-text-primary">Academia Veon</h1>
          <p className="text-text-muted mt-1">Crie sua conta para acessar a plataforma</p>
          {linkInfo?.description && (
            <p className="text-text-secondary text-sm mt-2 bg-bg-card border border-navy-800 rounded-lg px-4 py-2 inline-block">
              {linkInfo.description}
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-bg-card border border-navy-800 rounded-2xl p-8 space-y-4">
          {/* Nome completo */}
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Nome completo *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              required
              className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-red-veon transition-colors"
              placeholder="Seu nome completo"
            />
          </div>

          {/* CPF */}
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">CPF *</label>
            <input
              type="text"
              value={form.cpf}
              onChange={(e) => setForm(f => ({ ...f, cpf: formatCPF(e.target.value) }))}
              required
              className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-red-veon transition-colors"
              placeholder="000.000.000-00"
            />
          </div>

          {/* Email + Confirmação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                required
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-red-veon transition-colors"
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Confirme o email *</label>
              <input
                type="email"
                value={form.emailConfirm}
                onChange={(e) => setForm(f => ({ ...f, emailConfirm: e.target.value }))}
                required
                onPaste={(e) => e.preventDefault()}
                className={`w-full bg-bg-input border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none transition-colors ${
                  form.emailConfirm && form.email !== form.emailConfirm
                    ? 'border-red-veon'
                    : 'border-navy-700 focus:border-red-veon'
                }`}
                placeholder="Repita o email"
              />
            </div>
          </div>

          {/* WhatsApp */}
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">WhatsApp *</label>
            <input
              type="text"
              value={form.whatsapp}
              onChange={(e) => setForm(f => ({ ...f, whatsapp: formatWhatsApp(e.target.value) }))}
              required
              className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-red-veon transition-colors"
              placeholder="(00) 00000-0000"
            />
          </div>

          {/* Senha + Confirmação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Senha *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  minLength={6}
                  className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-red-veon transition-colors pr-12"
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
              <label className="block text-sm text-text-secondary mb-1.5">Confirme a senha *</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.passwordConfirm}
                onChange={(e) => setForm(f => ({ ...f, passwordConfirm: e.target.value }))}
                required
                onPaste={(e) => e.preventDefault()}
                className={`w-full bg-bg-input border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none transition-colors ${
                  form.passwordConfirm && form.password !== form.passwordConfirm
                    ? 'border-red-veon'
                    : 'border-navy-700 focus:border-red-veon'
                }`}
                placeholder="Repita a senha"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-veon text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-red-veon hover:bg-red-veon-dark text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 mt-2"
          >
            {submitting ? 'Criando conta...' : 'Criar minha conta'}
          </button>

          <p className="text-center text-xs text-text-muted mt-4">
            Já tem uma conta?{' '}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-red-veon hover:text-red-veon-dark transition-colors"
            >
              Faça login
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
