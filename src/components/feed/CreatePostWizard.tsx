import { useState, useRef, useEffect } from 'react'
import * as tus from 'tus-js-client'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { signR2Upload, initMultipart, type MultipartInit } from '../../hooks/useMediaUpload'
import { compressImage } from '../../lib/imageCompression'
import { useQueryClient } from '@tanstack/react-query'
import { startPostUpload, type UploadTarget, CHUNK_THRESHOLD } from '../../lib/postUploadManager'
import { useUploadStore } from '../../stores/uploadStore'
import { X, Image as ImageIcon, Video, Mic, Plus, Trash2, ChevronLeft, ChevronRight, Square, Play, Pause, Link as LinkIcon } from 'lucide-react'

const BUNNY_CDN_HOSTNAME = import.meta.env.VITE_BUNNY_CDN_HOSTNAME || 'vz-6d04ab5b-6ae.b-cdn.net'

type BunnyCreds = {
  videoId: string
  libraryId: string
  tusEndpoint: string
  authSignature: string
  authExpire: number
}

async function createBunnyVideo(title: string): Promise<BunnyCreds> {
  const res = await fetch('/api/bunny/create-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error('Falha ao criar vídeo no Bunny')
  return res.json()
}

function uploadToBunny(
  file: Blob,
  creds: BunnyCreds,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: creds.tusEndpoint,
      retryDelays: [0, 3000, 5000, 10000],
      headers: {
        AuthorizationSignature: creds.authSignature,
        AuthorizationExpire: creds.authExpire.toString(),
        VideoId: creds.videoId,
        LibraryId: creds.libraryId,
      },
      metadata: { filetype: file.type },
      onProgress: (loaded, total) => onProgress?.(loaded, total),
      onError: reject,
      onSuccess: () => resolve(),
    })
    upload.start()
  })
}

async function waitForBunnyEncoding(videoId: string, maxMs = 300_000): Promise<void> {
  const interval = 5000
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    await new Promise(r => setTimeout(r, interval))
    try {
      const res = await fetch(`/api/bunny/video-status?videoId=${videoId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.failed) throw new Error('Falha na transcodagem do vídeo. Tente enviar um arquivo MP4.')
        if (data.ready) return
      }
    } catch { /* keep polling */ }
  }
}

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
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
  const isGestor = profile?.role === 'gestor'

  const [step, setStep] = useState<'type' | 'pages' | 'caption'>('type')
  const [postType, setPostType] = useState<MediaType | null>(null)
  const [pages, setPages] = useState<PageData[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [caption, setCaption] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkCta, setLinkCta] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const CTA_MAX = 30

  function normalizeLink(raw: string): string | null {
    const trimmed = raw.trim()
    if (!trimmed) return null
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    try {
      const u = new URL(withScheme)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
      return u.toString()
    } catch {
      return null
    }
  }

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

  // New flow: DB row is created FIRST with status='uploading', then R2 uploads run
  // in a detached manager. Post is invisible to others until status flips to 'ready'.
  async function submit() {
    if (!user || !canProceed() || isSubmitting) return
    setIsSubmitting(true)

    let normalizedLink: string | null = null
    if (isGestor && linkUrl.trim()) {
      normalizedLink = normalizeLink(linkUrl)
      if (!normalizedLink) {
        setLinkError('Link inválido. Use um endereço como https://exemplo.com')
        setIsSubmitting(false)
        return
      }
    }
    setLinkError(null)

    try {
      const isVideoPost = postType === 'video'
      const feedKey = ['feed-posts', user.id]
      const currentProfile = queryClient.getQueryData<any>(['profile', user.id])

      // ── VIDEO PATH: upload direto para o Bunny Stream (transcodagem para MP4) ──
      if (isVideoPost) {
        // 1. Criar entrada de vídeo no Bunny para cada página
        const bunnyCredsPerPage = await Promise.all(
          pages.map((_, i) => createBunnyVideo(`post-${user.id}-${Date.now()}-${i}`))
        )

        // 2. Criar post row
        const { data: post, error: postErr } = await supabase
          .from('posts')
          .insert({
            user_id: user.id,
            caption: caption.trim() || null,
            status: 'uploading',
            link_url: normalizedLink,
            link_cta: normalizedLink ? (linkCta.trim() || null) : null,
          })
          .select()
          .single()
        if (postErr || !post) throw postErr || new Error('Falha ao criar post')

        // 3. Inserir post_pages com as URLs do CDN do Bunny
        //    thumbnail_url usa a thumbnail automática gerada pelo Bunny após transcodagem
        const pagesToInsert = pages.map((p, i) => {
          const { videoId } = bunnyCredsPerPage[i]
          return {
            post_id: post.id,
            type: p.type,
            image_url: `https://${BUNNY_CDN_HOSTNAME}/${videoId}/play_720p.mp4`,
            thumbnail_url: `https://${BUNNY_CDN_HOSTNAME}/${videoId}/thumbnail.jpg`,
            sort_order: i,
            duration_seconds: p.duration || null,
          }
        })
        const { data: insertedPages, error: pagesError } = await supabase
          .from('post_pages')
          .insert(pagesToInsert)
          .select()
        if (pagesError) throw pagesError

        // 4. Seeda o cache e fecha o modal
        const cachedPost = {
          ...post,
          link_url: normalizedLink,
          link_cta: normalizedLink ? (linkCta.trim() || null) : null,
          author: {
            name: currentProfile?.name || 'Você',
            avatar_url: currentProfile?.avatar_url || null,
            profession: currentProfile?.profession || null,
          },
          pages: insertedPages || [],
          likes: [],
          likedByMe: false,
          likesCount: 0,
          comments: [],
          commentsCount: 0,
          sharesCount: 0,
        }
        queryClient.setQueryData<any>(feedKey, (old: any) => {
          if (!old) return { pages: [{ posts: [cachedPost], nextCursor: null }], pageParams: [null] }
          const newPages = [...old.pages]
          newPages[0] = { ...newPages[0], posts: [cachedPost, ...(newPages[0]?.posts || [])] }
          return { ...old, pages: newPages }
        })
        onCreated()

        // 5. TUS uploads em background + aguarda transcodagem → marca ready
        const store = useUploadStore.getState()
        const totalBytes = pages.reduce((acc, p) => acc + (p.file?.size ?? 0), 0)
        store.start(post.id, totalBytes)

        const markReady = () => {
          useUploadStore.getState().complete(post.id)
          queryClient.setQueryData<any>(feedKey, (old: any) => {
            if (!old) return old
            return {
              ...old,
              pages: old.pages.map((page: any) => ({
                ...page,
                posts: page.posts.map((pp: any) => (pp.id === post.id ? { ...pp, status: 'ready' } : pp)),
              })),
            }
          })
        }

        Promise.all(
          pages.map((p, i) =>
            uploadToBunny(p.file!, bunnyCredsPerPage[i], (loaded, total) => {
              useUploadStore.getState().updateFile(post.id, bunnyCredsPerPage[i].videoId, loaded, total)
            })
          )
        ).then(async () => {
          await Promise.all(bunnyCredsPerPage.map(c => waitForBunnyEncoding(c.videoId)))
          await supabase.from('posts').update({ status: 'ready' }).eq('id', post.id)
          markReady()
        }).catch(err => {
          console.error('Bunny upload error:', err)
          useUploadStore.getState().fail(post.id, err?.message ?? 'Erro no upload')
        })

        return
      }

      // ── IMAGEM / ÁUDIO PATH: upload para R2 (sem mudança) ──

      // 1. Comprime imagens
      const processedFiles: Blob[] = []
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i]
        processedFiles[i] = p.type === 'image'
          ? await compressImage(p.file!).catch(() => p.file!)
          : p.file!
      }

      // 2. Assina uploads no R2
      type MediaSign =
        | { kind: 'single'; uploadUrl: string; publicUrl: string }
        | { kind: 'multipart'; init: MultipartInit }

      const signedPerPage = await Promise.all(
        pages.map(async (p, i) => {
          const mediaBlob = processedFiles[i]
          const mediaCT = mediaBlob.type || (p.type === 'audio' ? 'audio/webm' : 'image/webp')
          const mediaExt = p.type === 'image' ? (mediaCT === 'image/webp' ? 'webp' : 'jpg') : 'webm'
          const folder = `posts/${p.type}`

          let mediaSigned: MediaSign
          if (mediaBlob.size > CHUNK_THRESHOLD) {
            mediaSigned = { kind: 'multipart', init: await initMultipart(folder, mediaCT, mediaExt) }
          } else {
            const { uploadUrl, publicUrl } = await signR2Upload(folder, mediaCT, mediaExt)
            mediaSigned = { kind: 'single', uploadUrl, publicUrl }
          }
          return { mediaSigned, mediaCT }
        }),
      )

      // 3. Cria post row
      const { data: post, error: postErr } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          caption: caption.trim() || null,
          status: 'uploading',
          link_url: normalizedLink,
          link_cta: normalizedLink ? (linkCta.trim() || null) : null,
        })
        .select()
        .single()
      if (postErr || !post) throw postErr || new Error('Falha ao criar post')

      // 4. Insere post_pages
      const pagesToInsert = pages.map((p, i) => {
        const ms = signedPerPage[i].mediaSigned
        return {
          post_id: post.id,
          type: p.type,
          image_url: ms.kind === 'multipart' ? ms.init.publicUrl : ms.publicUrl,
          thumbnail_url: null,
          sort_order: i,
          duration_seconds: p.duration || null,
        }
      })
      const { data: insertedPages, error: pagesError } = await supabase
        .from('post_pages')
        .insert(pagesToInsert)
        .select()
      if (pagesError) throw pagesError

      // 5. Seeda o cache
      const cachedPost = {
        ...post,
        link_url: normalizedLink,
        link_cta: normalizedLink ? (linkCta.trim() || null) : null,
        author: {
          name: currentProfile?.name || 'Você',
          avatar_url: currentProfile?.avatar_url || null,
          profession: currentProfile?.profession || null,
        },
        pages: insertedPages || [],
        likes: [],
        likedByMe: false,
        likesCount: 0,
        comments: [],
        commentsCount: 0,
        sharesCount: 0,
      }
      queryClient.setQueryData<any>(feedKey, (old: any) => {
        if (!old) return { pages: [{ posts: [cachedPost], nextCursor: null }], pageParams: [null] }
        const newPages = [...old.pages]
        newPages[0] = { ...newPages[0], posts: [cachedPost, ...(newPages[0]?.posts || [])] }
        return { ...old, pages: newPages }
      })

      // 6. Fecha modal
      onCreated()

      // 7. Upload R2 em background
      const targets: UploadTarget[] = []
      for (let i = 0; i < pages.length; i++) {
        const s = signedPerPage[i]
        const pageRow = (insertedPages || [])[i]
        if (!pageRow) continue
        const ms = s.mediaSigned
        targets.push({
          pageId: pageRow.id,
          kind: 'media',
          file: processedFiles[i],
          contentType: s.mediaCT,
          uploadUrl: ms.kind === 'single' ? ms.uploadUrl : '',
          publicUrl: ms.kind === 'multipart' ? ms.init.publicUrl : ms.publicUrl,
          folder: `posts/${pages[i].type}`,
          multipartInit: ms.kind === 'multipart' ? ms.init : undefined,
        })
      }

      startPostUpload(post.id, targets).then(() => {
        queryClient.setQueryData<any>(feedKey, (old: any) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              posts: page.posts.map((pp: any) => (pp.id === post.id ? { ...pp, status: 'ready' } : pp)),
            })),
          }
        })
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(err)
      setIsSubmitting(false)
      alert(`Erro ao iniciar a publicação:\n\n${msg}\n\nTente novamente.`)
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

              {isGestor && (
                <div>
                  <label className="text-xs text-text-muted flex items-center gap-1.5 mb-1">
                    <LinkIcon className="w-3.5 h-3.5" /> Link redirecionável (opcional)
                  </label>
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => { setLinkUrl(e.target.value); setLinkError(null) }}
                    className="w-full bg-bg-input border border-navy-700 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-red-veon"
                    placeholder="https://exemplo.com"
                  />
                  {linkError && <p className="mt-1 text-xs text-red-veon">{linkError}</p>}
                  <p className="mt-1 text-xs text-text-muted">Usuários que clicarem no botão serão redirecionados para este endereço.</p>

                  {linkUrl.trim() && (
                    <div className="mt-3">
                      <div className="flex justify-between mb-1">
                        <label className="text-xs text-text-muted">Texto do botão (CTA)</label>
                        <span className="text-xs text-text-muted">{linkCta.length}/{CTA_MAX}</span>
                      </div>
                      <input
                        type="text"
                        value={linkCta}
                        onChange={(e) => { if (e.target.value.length <= CTA_MAX) setLinkCta(e.target.value) }}
                        className="w-full bg-bg-input border border-navy-700 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-red-veon"
                        placeholder="Ex: Saiba mais"
                      />
                      <p className="mt-1 text-xs text-text-muted">Se vazio, será exibido "Saiba mais".</p>
                    </div>
                  )}
                </div>
              )}
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
              <button onClick={submit} disabled={isSubmitting} className="flex-1 bg-red-veon hover:bg-red-veon-dark text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting ? 'Publicando...' : 'Publicar'}</button>
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
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={handleFile} className="hidden" />
    </div>
  )
}

// ============ VIDEO INPUT ============
const isMobileDevice = typeof window !== 'undefined'
  && window.matchMedia('(hover: none) and (pointer: coarse)').matches

function VideoInput({ page, onChange }: { page: PageData; onChange: (u: Partial<PageData>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const url = URL.createObjectURL(file)

    const probe = document.createElement('video')
    probe.preload = 'metadata'
    probe.src = url
    const duration = await new Promise<number>((resolve) => {
      probe.onloadedmetadata = () => resolve(Math.floor(probe.duration) || 0)
      probe.onerror = () => resolve(0)
    })

    if (duration > MAX_VIDEO_SECONDS) {
      URL.revokeObjectURL(url)
      alert(`O vídeo excede o limite de ${Math.floor(MAX_VIDEO_SECONDS / 60)}min${MAX_VIDEO_SECONDS % 60 ? (MAX_VIDEO_SECONDS % 60) : ''}. Escolha um vídeo mais curto.`)
      return
    }

    onChange({ file, previewUrl: url, duration: duration || undefined })
  }

  function reset() {
    onChange({ file: undefined, previewUrl: undefined, duration: undefined })
  }

  return (
    <div className="space-y-3">
      <div className="aspect-[4/5] rounded-xl bg-black overflow-hidden flex items-center justify-center relative">
        {page.previewUrl ? (
          <video
            src={page.previewUrl}
            className="w-full h-full object-cover"
            controls
            playsInline
          />
        ) : (
          <div className="text-text-muted text-center">
            <Video className="w-12 h-12 mx-auto mb-2" />
            <p className="text-sm">Grave ou envie um vídeo</p>
            <p className="text-xs">Máx. 2min30</p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {!page.previewUrl && (
          <>
            {isMobileDevice && (
              <button onClick={() => cameraRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 bg-red-veon hover:bg-red-veon-dark text-white text-sm py-2.5 rounded-lg">
                <Video className="w-4 h-4" /> Gravar
              </button>
            )}
            <button onClick={() => fileRef.current?.click()} className={`${isMobileDevice ? 'flex-1' : 'w-full'} flex items-center justify-center gap-2 bg-navy-800 hover:bg-navy-700 text-text-secondary hover:text-text-primary text-sm py-2.5 rounded-lg`}>
              Enviar vídeo
            </button>
          </>
        )}
        {page.previewUrl && (
          <button onClick={reset} className="text-xs text-red-veon hover:text-red-veon-dark">Refazer</button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/x-m4v" onChange={handleFile} className="hidden" />
      <input ref={cameraRef} type="file" accept="video/mp4,video/quicktime" capture="user" onChange={handleFile} className="hidden" />
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
