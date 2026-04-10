import { useState } from 'react'
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom'
import { GraduationCap, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export function LoginPage() {
  const { user, profile, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const defaultTripulanteRoute = '/comunidade'
  const returnTo = searchParams.get('returnTo') || defaultTripulanteRoute
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-veon border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (user && profile) {
    const defaultRoute = profile.role === 'gestor' ? '/gestor' : '/comunidade'
    const destination = searchParams.get('returnTo') ? returnTo : defaultRoute
    return <Navigate to={destination} replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error } = await signIn(email, password)
    if (error) {
      setError('Email ou senha incorretos')
    } else {
      navigate(returnTo)
    }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-3">
            <GraduationCap className="w-12 h-12 text-red-veon" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary">Academia Veon</h1>
          <p className="text-text-muted mt-1">Exclusiva para a Tripulação Veon</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-bg-card border border-navy-800 rounded-2xl p-8 space-y-5">
          <div>
            <label className="block text-sm text-text-secondary mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-red-veon transition-colors"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-2">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-bg-input border border-navy-700 rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-red-veon transition-colors pr-12"
                placeholder="••••••••"
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

          {error && (
            <p className="text-red-veon text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-red-veon hover:bg-red-veon-dark text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
