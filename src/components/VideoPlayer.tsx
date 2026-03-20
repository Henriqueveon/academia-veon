interface VideoPlayerProps {
  videoId: string
  libraryId?: string
  autoplay?: boolean
}

export function VideoPlayer({ videoId, libraryId, autoplay = false }: VideoPlayerProps) {
  const libId = libraryId || import.meta.env.VITE_BUNNY_LIBRARY_ID || '621207'
  const src = `https://iframe.mediadelivery.net/embed/${libId}/${videoId}?autoplay=${autoplay}&loop=false&muted=false&preload=true&responsive=true`

  return (
    <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
      <iframe
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
