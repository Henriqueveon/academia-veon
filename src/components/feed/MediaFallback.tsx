import { ImageOff } from 'lucide-react'

interface Props {
  variant?: 'image' | 'video' | 'audio'
}

export function MediaFallback({ variant = 'image' }: Props) {
  const label =
    variant === 'video'
      ? 'Não foi possível carregar o vídeo'
      : variant === 'audio'
      ? 'Áudio indisponível'
      : 'Não foi possível carregar a imagem'

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-navy-900 text-text-muted gap-2">
      <ImageOff className="w-10 h-10 opacity-60" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
