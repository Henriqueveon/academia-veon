import { useState, useEffect } from 'react'
import { Bell, X } from 'lucide-react'
import { isPushSupported, getNotificationPermission, requestPushPermissionAndSubscribe } from '../lib/push'
import { useAuth } from '../contexts/AuthContext'

const DISMISS_KEY = 'push-banner-dismissed'

export function PushPermissionBanner() {
  const { user } = useAuth()
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    if (!isPushSupported()) return

    const permission = getNotificationPermission()
    if (permission !== 'default') return // Already granted or denied

    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed) {
      // Show again after 3 days
      const dismissedAt = parseInt(dismissed, 10)
      if (Date.now() - dismissedAt < 3 * 24 * 60 * 60 * 1000) return
    }

    // Show banner after 5 seconds (let the user see the feed first)
    const timer = setTimeout(() => setShow(true), 5000)
    return () => clearTimeout(timer)
  }, [user])

  async function handleEnable() {
    setLoading(true)
    const result = await requestPushPermissionAndSubscribe()
    setLoading(false)

    if (result.ok) {
      setShow(false)
      localStorage.removeItem(DISMISS_KEY)
    } else if (result.reason === 'denied') {
      setShow(false)
      localStorage.setItem(DISMISS_KEY, Date.now().toString())
    }
  }

  function handleDismiss() {
    setShow(false)
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
  }

  if (!show) return null

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-40">
      <div className="bg-bg-card border border-red-veon/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-veon/20 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-red-veon" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-text-primary text-sm">Ativar notificações</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Receba avisos de novos posts, comentários e novidades direto no seu aparelho.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleEnable}
                disabled={loading}
                className="flex-1 bg-red-veon hover:bg-red-veon-dark text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Ativando...' : 'Ativar'}
              </button>
              <button
                onClick={handleDismiss}
                className="text-xs text-text-muted hover:text-text-primary px-3"
              >
                Agora não
              </button>
            </div>
          </div>
          <button onClick={handleDismiss} className="text-text-muted hover:text-text-primary flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
