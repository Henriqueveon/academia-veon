import { useCallback, useEffect, useState } from 'react'
import { useFeedReadyStore } from '../stores/feedReadyStore'

const READY_TIMEOUT_MS = 4000

/**
 * Gates a PostCard's content reveal until its first media has loaded
 * (img.onLoad / video.oncanplay) or a 4s failsafe timeout fires.
 *
 * Posts that have been seen during the session stay ready forever
 * (via feedReadyStore.readyIds) so that scrolling back doesn't re-skeleton.
 */
export function usePostReady(postId: string, options?: { isInitial?: boolean }) {
  const wasReady = useFeedReadyStore((s) => s.readyIds.has(postId))
  const markReady = useFeedReadyStore((s) => s.markReady)
  const [ready, setReady] = useState(wasReady)
  const [errored, setErrored] = useState(false)

  const finish = useCallback(() => {
    if (!ready) {
      setReady(true)
      markReady(postId, !!options?.isInitial)
    }
  }, [postId, ready, markReady, options?.isInitial])

  // Failsafe: never leave the card stuck in skeleton.
  useEffect(() => {
    if (ready) return
    const t = setTimeout(finish, READY_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [ready, finish])

  const onMediaLoad = useCallback(() => finish(), [finish])
  const onMediaError = useCallback(() => {
    setErrored(true)
    finish()
  }, [finish])

  return { ready, errored, onMediaLoad, onMediaError }
}
