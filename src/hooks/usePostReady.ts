import { useCallback, useEffect, useState } from 'react'
import { useFeedReadyStore } from '../stores/feedReadyStore'
import { useSlowConnection } from './useSlowConnection'

const READY_TIMEOUT_FAST_MS = 4000
const READY_TIMEOUT_SLOW_MS = 15000

/**
 * Gates a PostCard's content reveal until its first media has loaded
 * (img.onLoad / video.oncanplay) or a failsafe timeout fires.
 *
 * Timeout scales with connection quality: 4s on fast networks, 15s on
 * slow-2g/2g/3g/saveData so mobile users don't see the card unlocked
 * before the image actually arrives.
 *
 * Posts that have been seen during the session stay ready forever
 * (via feedReadyStore.readyIds) so that scrolling back doesn't re-skeleton.
 */
export function usePostReady(postId: string, options?: { isInitial?: boolean }) {
  const wasReady = useFeedReadyStore((s) => s.readyIds.has(postId))
  const markReady = useFeedReadyStore((s) => s.markReady)
  const [ready, setReady] = useState(wasReady)
  const [errored, setErrored] = useState(false)
  const { isSlow } = useSlowConnection()

  const finish = useCallback(() => {
    if (!ready) {
      setReady(true)
      markReady(postId, !!options?.isInitial)
    }
  }, [postId, ready, markReady, options?.isInitial])

  useEffect(() => {
    if (ready) return
    const timeout = isSlow ? READY_TIMEOUT_SLOW_MS : READY_TIMEOUT_FAST_MS
    const t = setTimeout(finish, timeout)
    return () => clearTimeout(t)
  }, [ready, finish, isSlow])

  const onMediaLoad = useCallback(() => finish(), [finish])
  const onMediaError = useCallback(() => {
    setErrored(true)
    finish()
  }, [finish])

  return { ready, errored, onMediaLoad, onMediaError }
}
