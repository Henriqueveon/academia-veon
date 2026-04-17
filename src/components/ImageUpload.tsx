import { useRef } from 'react'
import { Upload, X } from 'lucide-react'
import { useImageUpload } from '../hooks/useImageUpload'

interface ImageUploadProps {
  value: string
  onChange: (url: string) => void
  folder: string
  label?: string
  hint?: string
}

export function ImageUpload({ value, onChange, folder, label = 'Imagem de capa', hint }: ImageUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const { uploadImage, uploading } = useImageUpload()

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const url = await uploadImage(file, folder)
    if (url) onChange(url)

    // Reset input
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div>
      <label className="block text-sm text-text-secondary mb-1">{label}</label>

      {value ? (
        <div className="relative rounded-lg overflow-hidden border border-navy-700">
          <img src={value} alt="Capa" className="w-full h-36 object-cover" />
          <button
            onClick={() => onChange('')}
            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full h-36 border-2 border-dashed border-navy-700 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-navy-500 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <>
              <div className="w-6 h-6 border-2 border-red-veon border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-text-muted">Enviando...</span>
            </>
          ) : (
            <>
              <Upload className="w-6 h-6 text-text-muted" />
              <span className="text-xs text-text-muted">Clique para enviar imagem</span>
              {hint && <span className="text-xs text-text-muted/60">{hint}</span>}
            </>
          )}
        </button>
      )}

      {/* URL manual fallback */}
      <div className="mt-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-bg-input border border-navy-700 rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-red-veon"
          placeholder="Ou cole uma URL de imagem"
        />
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  )
}
