import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    fbq?: (...args: any[]) => void
    _fbq?: any
  }
}

// Injeta o Meta Pixel e dispara PageView. Retorna funções para custom events.
// pixelId: só o ID numérico (ex: "1234567890"). Null/undefined = desativado.
export function useMetaPixel(pixelId?: string | null) {
  const initializedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!pixelId) return
    if (initializedRef.current === pixelId) return

    // Se já existe um pixel diferente, não reinstala (evita conflitos entre navegações SPA)
    if (typeof window === 'undefined') return

    const id = pixelId.trim()
    if (!/^\d{6,20}$/.test(id)) {
      console.warn('[MetaPixel] ID inválido:', id)
      return
    }

    // Bootstrap padrão do Meta Pixel (apenas uma vez por página)
    if (!window.fbq) {
      const n: any = (window.fbq = function (...args: any[]) {
        n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args)
      })
      if (!window._fbq) window._fbq = n
      n.push = n
      n.loaded = true
      n.version = '2.0'
      n.queue = []

      const script = document.createElement('script')
      script.async = true
      script.src = 'https://connect.facebook.net/en_US/fbevents.js'
      document.head.appendChild(script)

    }

    window.fbq?.('init', id)
    window.fbq?.('track', 'PageView')
    initializedRef.current = id
  }, [pixelId])
}

// Dispara um evento customizado (ex: Lead). Safe no-op se pixel não iniciado.
export function trackPixelEvent(event: string, params?: Record<string, any>) {
  if (typeof window === 'undefined') return
  window.fbq?.('track', event, params)
}
