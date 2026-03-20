import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function useImageUpload() {
  const [uploading, setUploading] = useState(false)

  async function uploadImage(file: File, folder: string): Promise<string | null> {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error } = await supabase.storage
        .from('thumbnails')
        .upload(fileName, file, { cacheControl: '3600', upsert: false })

      if (error) throw error

      const { data } = supabase.storage.from('thumbnails').getPublicUrl(fileName)
      return data.publicUrl
    } catch (err) {
      console.error('Upload failed:', err)
      return null
    } finally {
      setUploading(false)
    }
  }

  return { uploadImage, uploading }
}
