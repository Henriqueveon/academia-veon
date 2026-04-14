import { create } from 'zustand'

export type RetryFile = {
  pageId: string
  kind: 'media' | 'thumb'
  file: Blob
  publicUrl: string
  contentType: string
}

export type UploadEntry = {
  progress: number
  bytesLoaded: number
  bytesTotal: number
  perFile: Record<string, { loaded: number; total: number }>
  status: 'uploading' | 'failed' | 'done'
  error?: string
  retryContext?: RetryFile[]
  retries: number
}

type UploadStore = {
  byPostId: Record<string, UploadEntry>
  start: (postId: string, totalBytes: number, retryContext?: RetryFile[]) => void
  updateFile: (postId: string, fileKey: string, loaded: number, total: number) => void
  fail: (postId: string, error: string, retryContext?: RetryFile[]) => void
  complete: (postId: string) => void
  clear: (postId: string) => void
  setRetryContext: (postId: string, retryContext: RetryFile[]) => void
}

function recomputeProgress(entry: UploadEntry): UploadEntry {
  let loaded = 0
  let total = 0
  for (const k of Object.keys(entry.perFile)) {
    loaded += entry.perFile[k].loaded
    total += entry.perFile[k].total
  }
  const progress = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0
  return { ...entry, bytesLoaded: loaded, bytesTotal: total || entry.bytesTotal, progress }
}

export const useUploadStore = create<UploadStore>((set) => ({
  byPostId: {},

  start: (postId, totalBytes, retryContext) =>
    set((s) => ({
      byPostId: {
        ...s.byPostId,
        [postId]: {
          progress: 0,
          bytesLoaded: 0,
          bytesTotal: totalBytes,
          perFile: {},
          status: 'uploading',
          retryContext,
          retries: s.byPostId[postId]?.retries ?? 0,
        },
      },
    })),

  updateFile: (postId, fileKey, loaded, total) =>
    set((s) => {
      const cur = s.byPostId[postId]
      if (!cur) return s
      const perFile = { ...cur.perFile, [fileKey]: { loaded, total } }
      const next = recomputeProgress({ ...cur, perFile })
      return { byPostId: { ...s.byPostId, [postId]: next } }
    }),

  fail: (postId, error, retryContext) =>
    set((s) => {
      const cur = s.byPostId[postId]
      if (!cur) {
        return {
          byPostId: {
            ...s.byPostId,
            [postId]: {
              progress: 0,
              bytesLoaded: 0,
              bytesTotal: 0,
              perFile: {},
              status: 'failed',
              error,
              retryContext,
              retries: 0,
            },
          },
        }
      }
      return {
        byPostId: {
          ...s.byPostId,
          [postId]: { ...cur, status: 'failed', error, retryContext: retryContext ?? cur.retryContext },
        },
      }
    }),

  complete: (postId) =>
    set((s) => {
      const cur = s.byPostId[postId]
      if (!cur) return s
      return {
        byPostId: { ...s.byPostId, [postId]: { ...cur, status: 'done', progress: 100 } },
      }
    }),

  clear: (postId) =>
    set((s) => {
      if (!(postId in s.byPostId)) return s
      const rest = { ...s.byPostId }
      delete rest[postId]
      return { byPostId: rest }
    }),

  setRetryContext: (postId, retryContext) =>
    set((s) => {
      const cur = s.byPostId[postId]
      if (!cur) return s
      return { byPostId: { ...s.byPostId, [postId]: { ...cur, retryContext } } }
    }),
}))
