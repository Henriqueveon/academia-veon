import { useState } from 'react'

// Persists last upload error so we can show it to the user (mobile debugging)
let lastUploadError: string | null = null
export function getLastUploadError(): string | null {
  return lastUploadError
}

export type SignedUpload = { uploadUrl: string; publicUrl: string; key: string }

export function toFriendlyError(raw: string): string {
  const msg = raw.toLowerCase()
  if (msg.includes('rede') || msg.includes('network') || msg.includes('failed to fetch')) {
    return 'Problema na conexão. Verifique sua internet e tente novamente.'
  }
  if (msg.includes('timeout') || msg.includes('10min')) {
    return 'O envio demorou muito. Tente novamente com uma conexão melhor.'
  }
  if (msg.includes('cancelado') || msg.includes('abort')) {
    return 'Envio cancelado.'
  }
  // R2 PUT failed with 4xx
  const status4xx = raw.match(/PUT falhou \(([45]\d\d)\)/)
  if (status4xx) {
    const code = parseInt(status4xx[1], 10)
    if (code >= 500) return 'Servidor indisponível. Tente novamente em instantes.'
    return 'Arquivo não aceito pelo servidor. Verifique o formato e tente novamente.'
  }
  return 'Houve um problema de conexão. Tentar novamente?'
}

export async function signR2Upload(folder: string, contentType: string, ext: string): Promise<SignedUpload> {
  const res = await fetch('/api/r2/sign-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder, contentType, ext }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Sign URL falhou (${res.status}): ${errText}`)
  }
  return res.json()
}

export function uploadBlobToR2(
  uploadUrl: string,
  blob: Blob | File,
  contentType: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl, true)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.timeout = 10 * 60 * 1000

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`R2 PUT falhou (${xhr.status}): ${xhr.responseText?.slice(0, 200) || ''}`))
    }
    xhr.onerror = () => reject(new Error('Erro de rede no upload'))
    xhr.ontimeout = () => reject(new Error('Timeout de upload (10min)'))
    xhr.onabort = () => reject(new Error('Upload cancelado'))
    try {
      xhr.send(blob)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      reject(new Error(`Erro ao iniciar upload: ${msg}`))
    }
  })
}

// ── Chunked upload via S3 Multipart (for files > CHUNK_THRESHOLD) ──────────

const CHUNK_SIZE = 5 * 1024 * 1024  // 5 MB (R2 minimum part size)
const CHUNK_CONCURRENCY = 3
const CHUNK_MAX_RETRIES = 3

async function uploadPartWithRetry(
  signedUrl: string,
  chunk: Blob,
  attempt = 0,
): Promise<string> {
  const res = await fetch(signedUrl, { method: 'PUT', body: chunk }).catch((err) => {
    throw new Error(`Erro de rede no upload: ${err.message}`)
  })
  if (res.ok) {
    const etag = res.headers.get('ETag') || res.headers.get('etag') || ''
    return etag.replace(/"/g, '')
  }
  if (attempt < CHUNK_MAX_RETRIES) {
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
    return uploadPartWithRetry(signedUrl, chunk, attempt + 1)
  }
  throw new Error(`R2 PUT falhou (${res.status}) após ${CHUNK_MAX_RETRIES} tentativas`)
}

async function multipartRequest(body: Record<string, unknown>): Promise<any> {
  const res = await fetch('/api/r2/multipart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Multipart error (${res.status}): ${text}`)
  }
  return res.json()
}

export type MultipartInit = { uploadId: string; key: string; publicUrl: string }

export async function initMultipart(folder: string, contentType: string, ext: string): Promise<MultipartInit> {
  return multipartRequest({ action: 'init', folder, contentType, ext })
}

export async function uploadBlobInChunks(
  blob: Blob,
  init: MultipartInit,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  const { uploadId, key } = init

  const totalSize = blob.size
  const numParts = Math.ceil(totalSize / CHUNK_SIZE)
  const bytesLoaded: number[] = new Array(numParts).fill(0)

  function reportProgress() {
    if (!onProgress) return
    onProgress(bytesLoaded.reduce((a, b) => a + b, 0), totalSize)
  }

  const parts: Array<{ partNumber: number; etag: string }> = []

  // 2. Upload parts with bounded concurrency
  let partIndex = 0
  async function uploadNext(): Promise<void> {
    if (partIndex >= numParts) return
    const i = partIndex++
    const partNumber = i + 1
    const start = i * CHUNK_SIZE
    const chunk = blob.slice(start, Math.min(start + CHUNK_SIZE, totalSize))

    const { signedUrl } = await multipartRequest({ action: 'sign-part', key, uploadId, partNumber })
    const etag = await uploadPartWithRetry(signedUrl, chunk)

    bytesLoaded[i] = chunk.size
    reportProgress()
    parts.push({ partNumber, etag })
    return uploadNext()
  }

  try {
    await Promise.all(Array.from({ length: CHUNK_CONCURRENCY }, uploadNext))

    // 3. Complete — parts must be sorted by partNumber
    parts.sort((a, b) => a.partNumber - b.partNumber)
    await multipartRequest({ action: 'complete', key, uploadId, parts })
  } catch (err) {
    // Best-effort abort to free R2 storage
    multipartRequest({ action: 'abort', key, uploadId }).catch(() => {})
    throw err
  }
}

export function useMediaUpload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  async function uploadMedia(file: File | Blob, folder: string, ext?: string): Promise<string | null> {
    setUploading(true)
    setProgress(0)
    lastUploadError = null

    const fileSize = file instanceof File || file instanceof Blob ? file.size : 0
    const fileSizeMb = (fileSize / (1024 * 1024)).toFixed(1)

    try {
      let finalExt = ext
      if (!finalExt) {
        if (file instanceof File) finalExt = file.name.split('.').pop() || 'bin'
        else finalExt = 'bin'
      }
      const contentType = (file instanceof File ? file.type : (file as Blob).type) || 'application/octet-stream'

      const onProgress = (loaded: number, total: number) => setProgress(Math.round((loaded / total) * 100))

      let publicUrl: string
      if (file.size > CHUNK_SIZE) {
        publicUrl = await uploadBlobInChunks(file, folder, contentType, finalExt, onProgress)
      } else {
        const { uploadUrl, publicUrl: signed } = await signR2Upload(folder, contentType, finalExt)
        await uploadBlobToR2(uploadUrl, file, contentType, onProgress)
        publicUrl = signed
      }

      setProgress(100)
      return publicUrl
    } catch (err: any) {
      const raw = err?.message || String(err)
      const friendly = toFriendlyError(raw)
      console.error('Upload failed:', raw, 'fileSize:', fileSizeMb + 'MB')
      lastUploadError = friendly
      return null
    } finally {
      setUploading(false)
    }
  }

  return { uploadMedia, uploading, progress }
}
