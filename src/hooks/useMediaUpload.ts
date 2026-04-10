import { useState } from 'react'
import { supabase } from '../lib/supabase'

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
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${finalExt}`

      const { error } = await supabase.storage
        .from('thumbnails')
        .upload(fileName, file, { cacheControl: '3600', upsert: false })

      if (error) throw error
      const { data } = supabase.storage.from('thumbnails').getPublicUrl(fileName)
      setProgress(100)
      return data.publicUrl
    } catch (err) {
      console.error('Upload failed:', err)
      return null
    } finally {
      setUploading(false)
    }
  }

  return { uploadMedia, uploading, progress }
}
