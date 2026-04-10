import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useMediaUpload } from '../../hooks/useMediaUpload'
import { useQueryClient } from '@tanstack/react-query'
import { X, Image as ImageIcon, Video, Mic, Plus, Trash2, ChevronLeft, ChevronRight, Square, Play, Pause } from 'lucide-react'

const CAPTION_MAX = 500
const MAX_PAGES = 5
const MAX_VIDEO_SECONDS = 150  // 2:30
const MAX_AUDIO_SECONDS = 180  // 3:00

type MediaType = 'image' | 'video' | 'audio'

interface PageData {
  type: MediaType
  file?: File | Blob
  previewUrl?: string
  duration?: number
}

interface Props {
  onClose: () => void
  onCreated: () => void
}

export function CreatePostWizard({ onClose, onCreated }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { uploadMedia } = useMediaUpload()

  const [step, setStep] = useState<'type' | 'pages' | 'caption'>('type')
  const [postType, setPostType] = useState<MediaType | null>(null)
  const [pages, setPages] = useState<PageData[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [caption, setCaption] = useState('')

  function selectType(type: MediaType) {
    setPostType(type)
    setPages([{ type }])
    setStep('pages')
  }

  function updateCurrentPage(updates: Partial<PageData>) {
    setPages(prev => prev.map((p, i) => i === currentPage ? { ...p, ...updates } : p))
  }

  function addPage() {
    if (pages.length >= MAX_PAGES || !postType) return
    setPages(prev => [...prev, { type: postType }])
    setCurrentPage(pages.length)
  }

  function removePage(index: number) {
    if (pages.length === 1) return
    setPages(prev => prev.filter((_, i) => i !== index))
    setCurrentPage(Math.max(0, currentPage - 1))
  }

  const currentPageData = pages[currentPage]

  function canProceed(): boolean {
    return pages.every(p => !!p.file && !!p.previewUrl)
  }

  // Optimistic submission — closes modal instantly, post appears immediately
  async function submit() {
    if (!user || !canProceed()) return

    // Build optimistic post with local previews (URL.createObjectURL)
    const tempId = `temp-${Date.now()}`

    // Try to fetch current user profile from cache for nicer optimistic display
    const currentProfile = queryClient.getQueryData<any>(['profile', user.id])

    const optimisticPost = {
      id: tempId,
      user_id: user.id,
      caption: caption.trim() || null,
      created_at: new Date().toISOString(),
      author: {
        name: currentProfile?.name || 'Você',
        avatar_url: currentProfile?.avatar_url || null,
        profession: currentProfile?.profession || null,
      },
      pages: pages.map((p, i) => ({
        id: `${tempId}-${i}`,
        post_id: tempId,
        type: p.type,
        image_url: p.previewUrl, // local blob URL — shows instantly
        sort_order: i,
        duration_seconds: p.duration || null,
      })),
      likes: [],
      likedByMe: false,
      likesCount: 0,
      comments: [],
      commentsCount: 0,
      sharesCount: 0,
      _uploading: true,
    }

    const feedKey = ['feed-posts', user.id]

    // Insert optimistic post into infinite query cache (page 0)
    queryClient.setQueryData<any>(feedKey, (old: any) => {
      if (!old) {
        return {
          pages: [{ posts: [optimisticPost], nextCursor: null }],
          pageParams: [null],
        }
      }
      const newPages = [...old.pages]
      newPages[0] = {
        ...newPages[0],
        posts: [optimisticPost, ...(newPages[0]?.posts || [])],
      }
      return { ...old, pages: newPages }
    })

    // Close modal IMMEDIATELY — user goes back to feed and sees the post
    onCreated()

    // Upload + insert in background — user already sees the post
    try {
      // Upload all media in parallel
      const urls = await Promise.all(pages.map(async (p) => {
        const ext = p.type === 'image' ? 'jpg' : p.type === 'video' ? 'webm' : 'webm'
        return await uploadMedia(p.file!, `posts/${p.type}`, ext)
      }))

      if (urls.some(u => !u)) throw new Error('Falha no upload')

      // Create the real post in DB
      const { data: post, error } = await supabase
        .from('posts')
        .insert({ user_id: user.id, caption: caption.trim() || null })
        .select()
        .single()
      if (error || !post) throw error

      const pagesToInsert = pages.map((p, i) => ({
        post_id: post.id,
        type: p.type,
        image_url: urls[i]!,
        sort_order: i,
        duration_seconds: p.duration || null,
      }))
      const { data: insertedPages, error: pagesError } = await supabase
        .from('post_pages')
        .insert(pagesToInsert)
        .select()
      if (pagesError) throw pagesError

      // SWAP optimistic post with real one (without disturbing feed)
      queryClient.setQueryData<any>(feedKey, (old: any) => {
        if (!old) return old
        const newPages = old.pages.map((page: any) => ({
          ...page,
          posts: page.posts.map((p: any) =>
            p.id === tempId
              ? {
                  ...post,
                  author: optimisticPost.author,
                  pages: insertedPages || optimisticPost.pages,
                  likes: [],
                  likedByMe: false,
                  likesCount: 0,
                  comments: [],
                  commentsCount: 0,
                  sharesCount: 0,
                  _uploading: false,
                }
              : p
          ),
        }))
        return { ...old, pages: newPages }
      })
    } catch (err) {
      console.error(err)
      // Remove optimistic post on error
      queryClient.setQueryData<any>(feedKey, (old: any) => {
        if (!old) return old
        const newPages = old.pages.map((page: any) => ({
          ...page,
          posts: page.posts.filter((p: any) => p.id !== tempId),
        }))
        return { ...old, pages: newPages }
      })
      alert('Erro ao publicar post. Tente novamente.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-card border border-navy-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-navy-800">
          <h2 className="text-lg font-semibold">
            {step === 'type' && 'Novo Post'}
            {step === 'pages' && (postType === 'image' ? `Foto ${currentPage + 1}/${pages.length}` : postType === 'video' ? 'Vídeo' : 'Áudio')}
            {step === 'caption' && 'Legenda'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* STEP 1: Choose type */}
          {step === 'type' && (
            <div className="space-y-3">
              <p className="text-sm text-text-muted mb-4">O que você quer compartilhar?</p>
              <button onClick={() => selectType('image')} className="w-full flex items-center gap-4 p-5 bg-bg-input border border-navy-700 rounded-xl hover:border-red-veon transition-colors">
                <div className="w-12 h-12 rounded-lg bg-purple-600/20 flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-purple-400" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-text-primary">Foto</p>
                  <p className="text-xs text-text-muted">Carrossel de até 5 imagens</p>
                </div>
              </button>
              <button onClick={() => selectType('video')} className="w-full flex items-center gap-4 p-5 bg-bg-input border border-navy-700 rounded-xl hover:border-red-veon transition-colors">
                <div className="w-12 h-12 rounded-lg bg-blue-600/20 flex items-center justify-center">
                  <Video className="w-6 h-6 text-blue-400" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-text-primary">Vídeo</p>
                  <p className="text-xs text-text-muted">Até 2min30 (gravar ou enviar)</p>
                </div>
              </button>
              <button onClick={() => selectType('audio')} className="w-full flex items-center gap-4 p-5 bg-bg-input border border-navy-700 rounded-xl hover:border-red-veon transition-colors">
                <div className="w-12 h-12 rounded-lg bg-green-600/20 flex items-center justify-center">
                  <Mic className="w-6 h-6 text-green-400" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-text-primary">Áudio</p>
                  <p className="text-xs text-text-muted">Até 3 minutos (gravar ou enviar)</p>
                </div>
              </button>
            </div>
          )}

          {/* STEP 2: Build pages */}
          {step === 'pages' && currentPageData && (
            <div>
              {/* Page navigator (only for images) */}
              {postType === 'image' && pages.length > 0 && (
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => setCurrentPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0} className="p-1 text-text-muted disabled:opacity-30">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="flex gap-1.5">
                    {pages.map((_, i) => (
                      <div key={i} className={`w-2 h-2 rounded-full ${i === currentPage ? 'bg-red-veon' : 'bg-navy-700'}`} />
                    ))}
                  </div>
                  <button onClick={() => setCurrentPage(Math.min(pages.length - 1, currentPage + 1))} disabled={currentPage === pages.length - 1} className="p-1 text-text-muted disabled:opacity-30">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}

              {currentPageData.type === 'image' && <ImageInput page={currentPageData} onChange={updateCurrentPage} />}
              {currentPageData.type === 'video' && <VideoInput page={currentPageData} onChange={updateCurrentPage} />}
              {currentPageData.type === 'audio' && <AudioInput page={currentPageData} onChange={updateCurrentPage} />}

              {/* Add/Remove (only images) */}
              {postType === 'image' && (
                <div className="flex gap-2 mt-4">
                  {pages.length < MAX_PAGES && (
                    <button onClick={addPage} className="flex items-center gap-1.5 text-xs bg-navy-800 hover:bg-navy-700 text-text-secondary hover:text-text-primary px-3 py-2 rounded-lg">
                      <Plus className="w-3.5 h-3.5" /> Adicionar foto
                    </button>
                  )}
                  {pages.length > 1 && (
                    <button onClick={() => removePage(currentPage)} className="flex items-center gap-1.5 text-xs bg-navy-800 hover:bg-red-900/50 text-text-secondary hover:text-red-veon px-3 py-2 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" /> Remover
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Caption */}
          {step === 'caption' && (
            <div className="space-y-4">
              <p className="text-sm text-text-muted">Adicione uma legenda (opcional)</p>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-text-muted">Legenda</label>
                  <span className="text-xs text-text-muted">{caption.length}/{CAPTION_MAX}</span>
                </div>
                <textarea
                  value={caption}
                  onChange={(e) => { if (e.target.value.length <= CAPTION_MAX) setCaption(e.target.value) }}
                  rows={5}
                  className="w-full bg-bg-input border border-navy-700 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-red-veon resize-none"
                  placeholder="Escreva uma legenda..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-navy-800 flex gap-2">
          {step === 'pages' && (
            <>
              <button onClick={() => setStep('type')} className="flex-1 bg-bg-input text-text-secondary hover:text-text-primary py-2.5 rounded-lg text-sm">Voltar</button>
              <button onClick={() => setStep('caption')} disabled={!canProceed()} className="flex-1 bg-red-veon hover:bg-red-veon-dark text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50">Próximo</button>
            </>
          )}
          {step === 'caption' && (
            <>
              <button onClick={() => setStep('pages')} className="flex-1 bg-bg-input text-text-secondary hover:text-text-primary py-2.5 rounded-lg text-sm">Voltar</button>
              <button onClick={submit} className="flex-1 bg-red-veon hover:bg-red-veon-dark text-white py-2.5 rounded-lg text-sm font-semibold">Publicar</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ============ IMAGE INPUT ============
function ImageInput({ page, onChange }: { page: PageData; onChange: (u: Partial<PageData>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    onChange({ file, previewUrl: url })
  }

  return (
    <div className="space-y-3">
      <div className="aspect-[4/5] rounded-xl bg-bg-input border-2 border-dashed border-navy-700 flex items-center justify-center overflow-hidden">
        {page.previewUrl ? (
          <img src={page.previewUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-2 text-text-muted hover:text-text-primary">
            <ImageIcon className="w-12 h-12" />
            <span className="text-sm">Clique para enviar foto</span>
            <span className="text-xs">Recomendado: 1080×1350</span>
          </button>
        )}
      </div>
      {page.previewUrl && (
        <button onClick={() => fileRef.current?.click()} className="text-xs text-red-veon hover:text-red-veon-dark">Trocar foto</button>
      )}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} className="hidden" />
    </div>
  )
}

// ============ VIDEO INPUT ============
function VideoInput({ page, onChange }: { page: PageData; onChange: (u: Partial<PageData>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordTime, setRecordTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)

  // Attach stream to video element when camera turns on
  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.muted = true
      videoRef.current.play().catch((err) => console.warn('Preview play failed:', err))
    }
  }, [cameraOn])

  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      })
      streamRef.current = stream
      setCameraOn(true)
    } catch (err) {
      alert('Não foi possível acessar a câmera')
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraOn(false)
  }

  function startRecording() {
    if (!streamRef.current) return
    const recorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' })
    mediaRecorderRef.current = recorder
    chunksRef.current = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      onChange({ file: blob, previewUrl: url, duration: recordTime })
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      if (videoRef.current) {
        videoRef.current.srcObject = null
        videoRef.current.src = url
        videoRef.current.muted = false
        videoRef.current.style.transform = ''
      }
      setCameraOn(false)
    }
    recorder.start()
    setRecording(true)
    setRecordTime(0)
    timerRef.current = window.setInterval(() => {
      setRecordTime(t => {
        if (t + 1 >= MAX_VIDEO_SECONDS) {
          stopRecording()
          return MAX_VIDEO_SECONDS
        }
        return t + 1
      })
    }, 1000)
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    onChange({ file, previewUrl: url })
  }

  function reset() {
    onChange({ file: undefined, previewUrl: undefined, duration: undefined })
  }

  const showCameraView = cameraOn || recording

  return (
    <div className="space-y-3">
      <div className="aspect-[4/5] rounded-xl bg-black overflow-hidden flex items-center justify-center relative">
        {(showCameraView || page.previewUrl) ? (
          <video
            ref={videoRef}
            src={!showCameraView ? page.previewUrl : undefined}
            className="w-full h-full object-cover"
            style={showCameraView ? { transform: 'scaleX(-1)' } : undefined}
            controls={!showCameraView}
            playsInline
            autoPlay={showCameraView}
            muted={showCameraView}
          />
        ) : (
          <div className="text-text-muted text-center">
            <Video className="w-12 h-12 mx-auto mb-2" />
            <p className="text-sm">Grave ou envie um vídeo</p>
            <p className="text-xs">Máx. 2min30</p>
          </div>
        )}

        {/* REC indicator */}
        {recording && (
          <div className="absolute top-3 left-3 bg-red-veon text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 z-10">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            REC {Math.floor(recordTime / 60)}:{(recordTime % 60).toString().padStart(2, '0')}
          </div>
        )}

        {/* Close camera button (when in preview, before recording) */}
        {cameraOn && !recording && (
          <button
            onClick={closeCamera}
            className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full z-10"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Big record button overlay */}
        {cameraOn && !recording && (
          <button
            onClick={startRecording}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white border-4 border-white/40 flex items-center justify-center shadow-2xl hover:scale-105 transition-transform z-10"
            title="Iniciar gravação"
          >
            <div className="w-12 h-12 rounded-full bg-red-veon" />
          </button>
        )}

        {/* Stop button overlay */}
        {recording && (
          <button
            onClick={stopRecording}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white border-4 border-white/40 flex items-center justify-center shadow-2xl hover:scale-105 transition-transform z-10"
            title="Parar gravação"
          >
            <div className="w-7 h-7 rounded bg-red-veon" />
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {!page.previewUrl && !cameraOn && !recording && (
          <>
            <button onClick={openCamera} className="flex-1 flex items-center justify-center gap-2 bg-red-veon hover:bg-red-veon-dark text-white text-sm py-2.5 rounded-lg">
              <Video className="w-4 h-4" /> Abrir câmera
            </button>
            <button onClick={() => fileRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 bg-navy-800 hover:bg-navy-700 text-text-secondary hover:text-text-primary text-sm py-2.5 rounded-lg">
              Enviar vídeo
            </button>
          </>
        )}
        {page.previewUrl && !recording && (
          <button onClick={reset} className="text-xs text-red-veon hover:text-red-veon-dark">Refazer</button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="video/*" onChange={handleFile} className="hidden" />
    </div>
  )
}

// ============ AUDIO INPUT ============
function AudioInput({ page, onChange }: { page: PageData; onChange: (u: Partial<PageData>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [recording, setRecording] = useState(false)
  const [recordTime, setRecordTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        onChange({ file: blob, previewUrl: url, duration: recordTime })
        stream.getTracks().forEach(t => t.stop())
      }
      recorder.start()
      setRecording(true)
      setRecordTime(0)
      timerRef.current = window.setInterval(() => {
        setRecordTime(t => {
          if (t + 1 >= MAX_AUDIO_SECONDS) {
            stopRecording()
            return MAX_AUDIO_SECONDS
          }
          return t + 1
        })
      }, 1000)
    } catch (err) {
      alert('Não foi possível acessar o microfone')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    onChange({ file, previewUrl: url })
  }

  function reset() {
    onChange({ file: undefined, previewUrl: undefined, duration: undefined })
    setPlaying(false)
  }

  function togglePlay() {
    if (!audioRef.current) return
    if (playing) audioRef.current.pause()
    else audioRef.current.play()
    setPlaying(!playing)
  }

  return (
    <div className="space-y-3">
      <div className="aspect-[4/5] rounded-xl bg-gradient-to-br from-green-900/50 to-navy-900 flex flex-col items-center justify-center p-8">
        {recording ? (
          <>
            <div className="w-32 h-32 rounded-full bg-red-veon/20 border-4 border-red-veon flex items-center justify-center mb-6 relative">
              <Mic className="w-14 h-14 text-red-veon" />
              <div className="absolute inset-0 rounded-full border-4 border-red-veon animate-ping" />
            </div>
            <p className="text-3xl font-mono text-text-primary mb-1">
              {Math.floor(recordTime / 60)}:{(recordTime % 60).toString().padStart(2, '0')}
            </p>
            <p className="text-xs text-text-muted">Gravando...</p>
          </>
        ) : page.previewUrl ? (
          <>
            <button onClick={togglePlay} className="w-24 h-24 rounded-full bg-green-600 hover:bg-green-700 flex items-center justify-center mb-4 transition-colors">
              {playing ? <Pause className="w-10 h-10 text-white" /> : <Play className="w-10 h-10 text-white ml-1" />}
            </button>
            <audio ref={audioRef} src={page.previewUrl} onEnded={() => setPlaying(false)} />
            <p className="text-sm text-text-secondary">Áudio gravado</p>
            {page.duration && (
              <p className="text-xs text-text-muted mt-1">
                {Math.floor(page.duration / 60)}:{(page.duration % 60).toString().padStart(2, '0')}
              </p>
            )}
          </>
        ) : (
          <>
            <Mic className="w-16 h-16 text-text-muted mb-3" />
            <p className="text-sm text-text-muted">Grave ou envie um áudio</p>
            <p className="text-xs text-text-muted mt-1">Máx. 3 minutos</p>
          </>
        )}
      </div>

      <div className="flex gap-2">
        {!page.previewUrl && !recording && (
          <>
            <button onClick={startRecording} className="flex-1 flex items-center justify-center gap-2 bg-red-veon hover:bg-red-veon-dark text-white text-sm py-2.5 rounded-lg">
              <Mic className="w-4 h-4" /> Gravar
            </button>
            <button onClick={() => fileRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 bg-navy-800 hover:bg-navy-700 text-text-secondary hover:text-text-primary text-sm py-2.5 rounded-lg">
              Enviar áudio
            </button>
          </>
        )}
        {recording && (
          <button onClick={stopRecording} className="w-full flex items-center justify-center gap-2 bg-red-veon hover:bg-red-veon-dark text-white text-sm py-2.5 rounded-lg">
            <Square className="w-4 h-4" /> Parar gravação
          </button>
        )}
        {page.previewUrl && !recording && (
          <button onClick={reset} className="text-xs text-red-veon hover:text-red-veon-dark">Refazer</button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="audio/*" onChange={handleFile} className="hidden" />
    </div>
  )
}
