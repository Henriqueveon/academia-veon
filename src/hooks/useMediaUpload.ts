import { useState } from 'react'

export function useMediaUpload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  async function uploadMedia(file: File | Blob, folder: string, ext?: string): Promise<string | null> {
    setUploading(true)
    setProgress(0)
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
        throw new Error('Failed to get upload URL')
      }

      const { uploadUrl, publicUrl } = await signRes.json()

      // 2. Upload directly to R2 using XHR for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl, true)
        xhr.setRequestHeader('Content-Type', contentType)

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100))
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`Upload failed: ${xhr.status}`))
        }
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.send(file)
      })

      setProgress(100)
      return publicUrl
    } catch (err) {
      console.error('Upload failed:', err)
      return null
    } finally {
      setUploading(false)
    }
  }

  return { uploadMedia, uploading, progress }
}
