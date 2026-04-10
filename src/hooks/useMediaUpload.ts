import { useState } from 'react'

// Persists last upload error so we can show it to the user (mobile debugging)
let lastUploadError: string | null = null
export function getLastUploadError(): string | null {
  return lastUploadError
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

      // 1. Get presigned URL from our serverless function
      const signRes = await fetch('/api/r2/sign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder, contentType, ext: finalExt }),
      })

      if (!signRes.ok) {
        const errText = await signRes.text().catch(() => '')
        throw new Error(`Sign URL falhou (${signRes.status}): ${errText}`)
      }

      const { uploadUrl, publicUrl } = await signRes.json()

      // 2. Upload directly to R2 using XHR for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl, true)
        xhr.setRequestHeader('Content-Type', contentType)

        // Generous timeout for mobile networks (10 minutes)
        xhr.timeout = 10 * 60 * 1000

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100))
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`R2 PUT falhou (${xhr.status}): ${xhr.responseText?.slice(0, 200) || ''}`))
        }
        xhr.onerror = () => reject(new Error(`Erro de rede no upload (arquivo ${fileSizeMb}MB)`))
        xhr.ontimeout = () => reject(new Error(`Timeout de upload (10min) — arquivo muito grande ou conexão lenta`))
        xhr.onabort = () => reject(new Error('Upload cancelado'))

        try {
          xhr.send(file)
        } catch (err: any) {
          reject(new Error(`Erro ao iniciar upload: ${err.message || err}`))
        }
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
