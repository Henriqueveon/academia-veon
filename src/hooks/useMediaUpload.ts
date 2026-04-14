import { useState } from 'react'

// Persists last upload error so we can show it to the user (mobile debugging)
let lastUploadError: string | null = null
export function getLastUploadError(): string | null {
  return lastUploadError
}

export type SignedUpload = { uploadUrl: string; publicUrl: string; key: string }

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
    xhr.onerror = () => reject(new Error(`Erro de rede no upload`))
    xhr.ontimeout = () => reject(new Error(`Timeout de upload (10min)`))
    xhr.onabort = () => reject(new Error('Upload cancelado'))
    try {
      xhr.send(blob)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      reject(new Error(`Erro ao iniciar upload: ${msg}`))
    }
  })
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

      const { uploadUrl, publicUrl } = await signR2Upload(folder, contentType, finalExt)

      await uploadBlobToR2(uploadUrl, file, contentType, (loaded, total) => {
        setProgress(Math.round((loaded / total) * 100))
      })

      setProgress(100)
      return publicUrl
    } catch (err: any) {
      const msg = err?.message || String(err)
      console.error('Upload failed:', msg, 'fileSize:', fileSizeMb + 'MB')
      lastUploadError = msg
      return null
    } finally {
      setUploading(false)
    }
  }

  return { uploadMedia, uploading, progress }
}
