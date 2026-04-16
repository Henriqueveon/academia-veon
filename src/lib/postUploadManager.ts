import { supabase } from './supabase'
import { signR2Upload, initMultipart, uploadBlobToR2, uploadBlobInChunks, toFriendlyError, type MultipartInit } from '../hooks/useMediaUpload'
import { useUploadStore, type RetryFile } from '../stores/uploadStore'

export type UploadTarget = {
  pageId: string
  kind: 'media' | 'thumb'
  file: Blob
  contentType: string
  uploadUrl: string        // used for single-PUT (small files)
  publicUrl: string
  folder?: string          // needed for re-sign on retry; defaults to 'posts'
  multipartInit?: MultipartInit  // pre-initialized multipart for large files
}

const MAX_RETRIES = 3
export const CHUNK_THRESHOLD = 10 * 1024 * 1024  // 10 MB → use multipart above this

function fileKey(t: { pageId: string; kind: string }) {
  return `${t.pageId}:${t.kind}`
}

async function runUploads(postId: string, targets: UploadTarget[]): Promise<void> {
  const store = useUploadStore.getState()
  const totalBytes = targets.reduce((sum, t) => sum + (t.file.size || 0), 0)

  const retryContext: RetryFile[] = targets.map((t) => ({
    pageId: t.pageId,
    kind: t.kind,
    file: t.file,
    publicUrl: t.publicUrl,
    contentType: t.contentType,
  }))

  store.start(postId, totalBytes, retryContext)
  for (const t of targets) {
    useUploadStore.getState().updateFile(postId, fileKey(t), 0, t.file.size || 0)
  }

  try {
    await Promise.all(
      targets.map((t) => {
        const onProgress = (loaded: number, total: number) => {
          useUploadStore.getState().updateFile(postId, fileKey(t), loaded, total)
        }

        if (t.multipartInit) {
          // Large file: multipart was pre-initialized in the wizard with the correct publicUrl.
          return uploadBlobInChunks(t.file, t.multipartInit, onProgress).then(() => {
            useUploadStore.getState().updateFile(postId, fileKey(t), t.file.size, t.file.size)
          })
        }

        return uploadBlobToR2(t.uploadUrl, t.file, t.contentType, onProgress)
      }),
    )

    const { error } = await supabase
      .from('posts')
      .update({ status: 'ready' })
      .eq('id', postId)
    if (error) throw error

    useUploadStore.getState().complete(postId)
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    const friendly = toFriendlyError(raw)
    await supabase
      .from('posts')
      .update({ status: 'failed', failed_reason: friendly.slice(0, 500) })
      .eq('id', postId)
    useUploadStore.getState().fail(postId, friendly)
    throw err
  }
}

export async function startPostUpload(postId: string, targets: UploadTarget[]): Promise<void> {
  await runUploads(postId, targets).catch(() => {
    /* already stored in uploadStore; don't throw — caller is fire-and-forget */
  })
}

export async function retryPostUpload(postId: string, folder: string): Promise<void> {
  const entry = useUploadStore.getState().byPostId[postId]
  if (!entry || entry.status === 'uploading') return
  if (!entry.retryContext || entry.retryContext.length === 0) return
  if (entry.retries >= MAX_RETRIES) {
    useUploadStore.getState().fail(postId, 'Número máximo de tentativas atingido.')
    return
  }

  useUploadStore.setState((s) => {
    const cur = s.byPostId[postId]
    if (!cur) return s
    return { byPostId: { ...s.byPostId, [postId]: { ...cur, retries: cur.retries + 1 } } }
  })

  // Re-sign new R2 keys (old signed URLs may have expired).
  const signed: UploadTarget[] = []
  const pageUpdates = new Map<string, { image_url?: string; thumbnail_url?: string }>()

  for (const f of entry.retryContext) {
    const ext = f.contentType.includes('jpeg') ? 'jpg' : f.contentType.split('/').pop() || 'bin'
    let uploadUrl = ''
    let publicUrl = f.publicUrl
    let multipartInit: MultipartInit | undefined

    if (f.file.size > CHUNK_THRESHOLD) {
      // Re-init multipart to get a fresh uploadId + correct publicUrl
      multipartInit = await initMultipart(folder, f.contentType, ext)
      publicUrl = multipartInit.publicUrl
    } else {
      const result = await signR2Upload(folder, f.contentType, ext)
      uploadUrl = result.uploadUrl
      publicUrl = result.publicUrl
    }

    signed.push({ pageId: f.pageId, kind: f.kind, file: f.file, contentType: f.contentType, uploadUrl, publicUrl, folder, multipartInit })
    const patch = pageUpdates.get(f.pageId) || {}
    if (f.kind === 'media') patch.image_url = publicUrl
    else patch.thumbnail_url = publicUrl
    pageUpdates.set(f.pageId, patch)
  }

  // Rewrite post_pages URLs to match the new signed keys.
  for (const [pageId, patch] of pageUpdates) {
    await supabase.from('post_pages').update(patch).eq('id', pageId)
  }

  await supabase
    .from('posts')
    .update({ status: 'uploading', failed_reason: null, upload_started_at: new Date().toISOString() })
    .eq('id', postId)

  await runUploads(postId, signed).catch(() => {})
}

export async function discardPost(postId: string): Promise<void> {
  // Delete page rows first (in case FK is not cascading), then the post.
  await supabase.from('post_pages').delete().eq('post_id', postId)
  await supabase.from('posts').delete().eq('id', postId).neq('status', 'ready')
  useUploadStore.getState().clear(postId)
}
