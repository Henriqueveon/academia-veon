import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    fbq?: (...args: any[]) => void
    _fbq?: any
  }
}

// Controle global — sobrevive a remounts de componentes na SPA
const _pixelPageViewed = new Set<string>()
let _pixelScriptLoaded = false

// Injeta o Meta Pixel e dispara PageView. Retorna funções para custom events.
// pixelId: só o ID numérico (ex: "1234567890"). Null/undefined = desativado.
export function useMetaPixel(pixelId?: string | null) {
  const initializedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!pixelId) return
    if (typeof window === 'undefined') return

    const id = pixelId.trim()
    if (!/^\d{6,20}$/.test(id)) {
      console.warn('[MetaPixel] ID inválido:', id)
      return
    }

    if (_pixelPageViewed.has(id)) {
      initializedRef.current = id
      return
    }

    // Bootstrap padrão do Meta Pixel (apenas uma vez por página)
    if (!_pixelScriptLoaded) {
      _pixelScriptLoaded = true
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
    _pixelPageViewed.add(id)
    initializedRef.current = id
  }, [pixelId])
}

// Dispara um evento padrão do Meta (ex: Lead, ViewContent). Safe no-op se pixel não iniciado.
export function trackPixelEvent(event: string, params?: Record<string, any>) {
  if (typeof window === 'undefined') return
  window.fbq?.('track', event, params)
}

// Dispara um evento customizado (ex: VideoPlay, VideoProgress). Safe no-op se pixel não iniciado.
export function trackCustomPixelEvent(event: string, params?: Record<string, any>) {
  if (typeof window === 'undefined') return
  window.fbq?.('trackCustom', event, params)
}
