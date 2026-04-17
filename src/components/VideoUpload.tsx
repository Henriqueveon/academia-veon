import { useState, useRef } from 'react'
import * as tus from 'tus-js-client'
import { X, CheckCircle, Loader2, Film } from 'lucide-react'

interface VideoUploadProps {
  onUploadComplete: (videoId: string) => void
  currentVideoId?: string | null
  onRemoveVideo?: () => void
}

export function VideoUpload({ onUploadComplete, currentVideoId, onRemoveVideo }: VideoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState(!!currentVideoId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<tus.Upload | null>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('video/')) {
      setError('Selecione um arquivo de vídeo')
      return
    }

    setUploading(true)
    setProgress(0)
    setError(null)

    try {
      // Step 1: Create video on Bunny via our API route
      const createRes = await fetch('/api/bunny/create-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: file.name.replace(/\.[^.]+$/, '') }),
      })

      if (!createRes.ok) {
        throw new Error('Falha ao criar vídeo')
      }

      const { videoId, libraryId, tusEndpoint, authSignature, authExpire } = await createRes.json()

      // Step 2: Upload via TUS protocol (direct to Bunny CDN, no proxy)
      const upload = new tus.Upload(file, {
        endpoint: tusEndpoint,
        retryDelays: [0, 3000, 5000, 10000],
        headers: {
          AuthorizationSignature: authSignature,
          AuthorizationExpire: authExpire.toString(),
          VideoId: videoId,
          LibraryId: libraryId,
        },
        metadata: {
          filetype: file.type,
          title: file.name,
        },
        onError: (err) => {
          console.error('Upload error:', err)
          setError('Erro no upload. Tente novamente.')
          setUploading(false)
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const pct = Math.round((bytesUploaded / bytesTotal) * 100)
          setProgress(pct)
        },
        onSuccess: () => {
          setUploading(false)
          setUploaded(true)
          onUploadComplete(videoId)
        },
      })

      uploadRef.current = upload
      upload.start()
    } catch (err) {
      console.error('Upload setup error:', err)
      setError('Erro ao iniciar upload')
      setUploading(false)
    }
  }

  const cancelUpload = () => {
    if (uploadRef.current) {
      uploadRef.current.abort()
      uploadRef.current = null
    }
    setUploading(false)
    setProgress(0)
  }

  const removeVideo = () => {
    setUploaded(false)
    onRemoveVideo?.()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (uploaded && currentVideoId) {
    return (
      <div className="border border-navy-700 rounded-lg p-4 flex items-center justify-between bg-navy-800/50">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <span className="text-sm text-slate-300">Vídeo enviado</span>
          <span className="text-xs text-slate-500 font-mono">{currentVideoId.slice(0, 8)}...</span>
        </div>
        <button onClick={removeVideo} className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1">
          <X className="w-4 h-4" /> Remover
        </button>
      </div>
    )
  }

  if (uploading) {
    return (
      <div className="border border-navy-700 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <span className="text-sm text-slate-300">Enviando vídeo... {progress}%</span>
          </div>
          <button onClick={cancelUpload} className="text-red-400 hover:text-red-300 text-sm">
            Cancelar
          </button>
        </div>
        <div className="w-full bg-navy-900 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <label
        className="border-2 border-dashed border-navy-600 rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-blue-500 transition-colors"
        htmlFor="video-upload"
      >
        <Film className="w-8 h-8 text-slate-400" />
        <span className="text-sm text-slate-400">Clique para enviar vídeo</span>
        <span className="text-xs text-slate-500">MP4, MOV, HEVC, WEBM (máx. 2GB)</span>
        <input
          id="video-upload"
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </label>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}
