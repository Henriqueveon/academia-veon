export type CompressOptions = {
  maxDim?: number
  quality?: number
  format?: 'webp' | 'jpeg'
}

let webpSupported: boolean | null = null

async function detectWebpSupport(): Promise<boolean> {
  if (webpSupported !== null) return webpSupported
  if (typeof document === 'undefined') return false
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const blob: Blob | null = await new Promise((res) =>
    canvas.toBlob((b) => res(b), 'image/webp', 0.5),
  )
  webpSupported = !!blob && blob.type === 'image/webp'
  return webpSupported
}

async function loadBitmap(file: Blob): Promise<{ bitmap: ImageBitmap | null; width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bm = await createImageBitmap(file)
      return { bitmap: bm, width: bm.width, height: bm.height }
    } catch {
      // fall through to <img>
    }
  }
  // Fallback via <img>
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('falha ao decodificar imagem'))
      i.src = url
    })
    return { bitmap: null, width: img.naturalWidth, height: img.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function compressImage(file: Blob, opts: CompressOptions = {}): Promise<Blob> {
  const { maxDim = 1920, quality = 0.85 } = opts
  const wantWebp = (opts.format ?? 'webp') === 'webp'
  const useWebp = wantWebp && (await detectWebpSupport())
  const mime = useWebp ? 'image/webp' : 'image/jpeg'

  const { bitmap, width, height } = await loadBitmap(file)
  const longest = Math.max(width, height)
  const scale = longest > maxDim ? maxDim / longest : 1
  const targetW = Math.round(width * scale)
  const targetH = Math.round(height * scale)

  // Prefer OffscreenCanvas when available (off-thread)
  const canCanvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(targetW, targetH)
      : null

  if (canCanvas) {
    const ctx = canCanvas.getContext('2d')
    if (!ctx) throw new Error('contexto 2d indisponível')
    if (bitmap) ctx.drawImage(bitmap, 0, 0, targetW, targetH)
    else {
      const url = URL.createObjectURL(file)
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image()
          i.onload = () => resolve(i)
          i.onerror = () => reject(new Error('decode fallback'))
          i.src = url
        })
        ctx.drawImage(img, 0, 0, targetW, targetH)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    const out = await canCanvas.convertToBlob({ type: mime, quality })
    if (bitmap) bitmap.close()
    return out
  }

  // DOM canvas fallback
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('contexto 2d indisponível')
  if (bitmap) ctx.drawImage(bitmap, 0, 0, targetW, targetH)
  else {
    const url = URL.createObjectURL(file)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = () => reject(new Error('decode fallback'))
        i.src = url
      })
      ctx.drawImage(img, 0, 0, targetW, targetH)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality))
  if (bitmap) bitmap.close()
  if (!out) throw new Error('canvas.toBlob retornou null')
  return out
}
