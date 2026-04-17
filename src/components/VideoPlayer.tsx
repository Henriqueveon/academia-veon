import { useEffect, useRef, useState } from 'react'
import { Spinner } from './ui/Spinner'
import { MediaFallback } from './feed/MediaFallback'

interface VideoPlayerProps {
  videoId: string
  libraryId?: string
  autoplay?: boolean
  onVideoComplete?: () => void
  onPlay?: () => void
  onProgress?: (percent: number) => void
}

export function VideoPlayer({ videoId, libraryId, autoplay: _autoplay = false, onVideoComplete, onPlay, onProgress }: VideoPlayerProps) {
  const libId = libraryId || import.meta.env.VITE_BUNNY_LIBRARY_ID || '621207'
  const src = `https://iframe.mediadelivery.net/embed/${libId}/${videoId}?autoplay=false&loop=false&muted=false&preload=true&responsive=true`
  const completedRef = useRef(false)
  const playFiredRef = useRef(false)
  const milestonesRef = useRef<Set<number>>(new Set())
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    if (iframeLoaded) return
    const t = setTimeout(() => setLoadFailed(true), 20000)
    return () => clearTimeout(t)
  }, [iframeLoaded])

  useEffect(() => {
    completedRef.current = false
    playFiredRef.current = false
    milestonesRef.current = new Set()

    function processEvent(msg: { event: string; data?: any }) {
      if (msg.event === 'play' || msg.event === 'videoPlay') {
        if (!playFiredRef.current) {
          playFiredRef.current = true
          onPlay?.()
        }
      }
      if (msg.event === 'videoProgress' && typeof msg.data === 'number') {
        if (!playFiredRef.current) {
          playFiredRef.current = true
          onPlay?.()
        }
        const milestones = [25, 50, 75, 100]
        const pct = Math.floor(msg.data * 100)
        for (const m of milestones) {
          if (pct >= m && !milestonesRef.current.has(m)) {
            milestonesRef.current.add(m)
            onProgress?.(m)
          }
        }
        if (msg.data >= 0.9 && !completedRef.current) {
          completedRef.current = true
          onVideoComplete?.()
        }
      }
      if (msg.event === 'ended' || msg.event === 'videoEnded') {
        if (!milestonesRef.current.has(100)) {
          milestonesRef.current.add(100)
          onProgress?.(100)
        }
        if (!completedRef.current) {
          completedRef.current = true
          onVideoComplete?.()
        }
      }
    }

    function handleMessage(event: MessageEvent) {
      if (typeof event.data === 'string') {
        try { processEvent(JSON.parse(event.data)) } catch { /* not JSON */ }
      }
      if (typeof event.data === 'object' && event.data !== null) {
        processEvent(event.data)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [videoId, onVideoComplete, onPlay, onProgress])

  return (
    <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
      <iframe
        id={`bunny-player-${videoId}`}
        src={src}
        loading="lazy"
        onLoad={() => setIframeLoaded(true)}
        className="absolute inset-0 w-full h-full rounded-lg"
        style={{ border: 'none' }}
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
      {!iframeLoaded && !loadFailed && (
        <div className="absolute inset-0 flex items-center justify-center bg-navy-900 rounded-lg">
          <Spinner size="lg" />
        </div>
      )}
      {!iframeLoaded && loadFailed && <MediaFallback variant="video" />}
    </div>
  )
}