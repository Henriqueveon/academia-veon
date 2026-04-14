interface Props {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_CLASSES = {
  sm: 'w-5 h-5 border-2',
  md: 'w-10 h-10 border-[3px]',
  lg: 'w-14 h-14 border-4',
} as const

export function Spinner({ size = 'md', className = '' }: Props) {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className={`${SIZE_CLASSES[size]} border-white/30 border-t-white rounded-full animate-spin ${className}`}
    />
  )
}
