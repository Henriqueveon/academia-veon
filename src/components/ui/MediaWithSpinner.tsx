import { useState, useEffect, type ReactNode, type ImgHTMLAttributes } from 'react'
import { Spinner } from './Spinner'

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onLoad' | 'onError'> {
  src: string | undefined | null
  alt: string
  fallback: ReactNode
  containerClassName?: string
  spinnerSize?: 'sm' | 'md' | 'lg'
  onLoad?: () => void
  onError?: () => void
}

export function MediaWithSpinner({
  src,
  alt,
  fallback,
  containerClassName = '',
  spinnerSize = 'sm',
  className = '',
  onLoad,
  onError,
  ...imgProps
}: Props) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(src ? 'loading' : 'error')

  useEffect(() => {
    setStatus(src ? 'loading' : 'error')
  }, [src])

  if (!src || status === 'error') {
    return <div className={`flex items-center justify-center ${containerClassName}`}>{fallback}</div>
  }

  return (
    <div className={`relative ${containerClassName}`}>
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-navy-900">
          <Spinner size={spinnerSize} />
        </div>
      )}
      <img
        {...imgProps}
        src={src}
        alt={alt}
        className={className}
        onLoad={() => {
          setStatus('loaded')
          onLoad?.()
        }}
        onError={() => {
          setStatus('error')
          onError?.()
        }}
      />
    </div>
  )
}
