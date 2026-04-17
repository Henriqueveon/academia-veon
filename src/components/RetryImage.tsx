import { useEffect, useRef, useState } from 'react'

const DEFAULT_MAX_RETRIES = 3

interface RetryImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  maxRetries?: number
}

export function RetryImage({ src, onError, maxRetries = DEFAULT_MAX_RETRIES, ...props }: RetryImageProps) {
  const [displaySrc, setDisplaySrc] = useState(src)
  const retriesRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    retriesRef.current = 0
    setDisplaySrc(src)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [src])

  function handleError(e: React.SyntheticEvent<HTMLImageElement>) {
    if (retriesRef.current < maxRetries) {
      const delay = Math.pow(2, retriesRef.current) * 1000
      retriesRef.current += 1
      const attempt = retriesRef.current
      timerRef.current = setTimeout(() => {
        const sep = src.includes('?') ? '&' : '?'
        setDisplaySrc(`${src}${sep}_r=${attempt}`)
      }, delay)
    } else {
      onError?.(e)
    }
  }

  return <img src={displaySrc} onError={handleError} {...props} />
}
