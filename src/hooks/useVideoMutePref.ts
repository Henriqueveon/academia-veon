import { useState } from 'react'

const KEY = 'feed_video_muted'

export function useVideoMutePref() {
  const [muted, setMuted] = useState(() =>
    localStorage.getItem(KEY) !== 'false'
  )

  function toggle() {
    setMuted(m => {
      const next = !m
      localStorage.setItem(KEY, String(next))
      return next
    })
  }

  return { muted, toggle }
}
