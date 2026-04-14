import { useState } from 'react'

// Upload de imagens (avatar, capa, etc) direto pro R2 via presigned URL
// Mantém a mesma API do hook antigo (uploadImage + uploading) para não
// quebrar os componentes que já usam este hook.
export function useImageUpload() {
  const [uploading, setUploading] = useState(false)

  async function uploadImage(file: File, folder: string): Promise<string | null> {
    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const contentType = file.type || 'image/jpeg'

      // 1. Pede a presigned URL à nossa função serverless
      const signRes = await fetch('/api/r2/sign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder, contentType, ext }),
      })

      if (!signRes.ok) {
        const errText = await signRes.text().catch(() => '')
        console.error('Sign URL failed:', signRes.status, errText)
        return null
      }

      const { uploadUrl, publicUrl } = await signRes.json()

      // 2. Upload direto pro R2
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      })

      if (!putRes.ok) {
        console.error('R2 upload failed:', putRes.status)
        return null
      }

      return publicUrl as string
    } catch (err) {
      console.error('Upload failed:', err)
      return null
    } finally {
      setUploading(false)
    }
  }

  return { uploadImage, uploading }
}
