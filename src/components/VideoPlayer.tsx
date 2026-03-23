import { useEffect, useRef } from 'react'

interface VideoPlayerProps {
  videoId: string
  libraryId?: string
  autoplay?: boolean
  onVideoComplete?: () => void
}

export function VideoPlayer({ videoId, libraryId, autoplay = false, onVideoComplete }: VideoPlayerProps) {
  const libId = libraryId || import.meta.env.VITE_BUNNY_LIBRARY_ID || '621207'
  const src = `https://iframe.mediadelivery.net/embed/${libId}/${videoId}?autoplay=false&loop=false&muted=false&preload=true&responsive=true`
  const completedRef = useRef(false)

  useEffect(() => {
    if (!onVideoComplete) return
    completedRef.current = false

    function handleMessage(event: MessageEvent) {
      // Bunny player sends progress events
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data)
          // Bunny sends { event: 'videoProgress', data: number (0-1) }
          if (msg.event === 'videoProgress' && typeof msg.data === 'number') {
            if (msg.data >= 0.9 && !completedRef.current) {
              completedRef.current = true
              onVideoComplete()
            }
          }
          // Also handle video ended event
          if (msg.event === 'ended' || msg.event === 'videoEnded') {
            if (!completedRef.current) {
              completedRef.current = true
              onVideoComplete()
            }
          }
        } catch {
          // not JSON, ignore
        }
      }
      // Bunny also sends object messages
      if (typeof event.data === 'object' && event.data !== null) {
        const msg = event.data
        if (msg.event === 'videoProgress' && typeof msg.data === 'number') {
          if (msg.data >= 0.9 && !completedRef.current) {
            completedRef.current = true
            onVideoComplete()
          }
        }
        if (msg.event === 'ended' || msg.event === 'videoEnded') {
          if (!completedRef.current) {
            completedRef.current = true
            onVideoComplete()
          }
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [videoId, onVideoComplete])

  return (
    <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
      <iframe
        id={`bunny-player-${videoId}`}
        src={src}
        loading="lazy"
        className="absolute inset-0 w-full h-full rounded-lg"
        style={{ border: 'none' }}
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}