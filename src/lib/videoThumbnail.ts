// Generate a JPEG thumbnail from the first frame of a video file/blob
// Returns a Blob ready to upload
export async function generateVideoThumbnail(file: File | Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file)
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.muted = true
      video.playsInline = true
      video.crossOrigin = 'anonymous'
      video.src = url

      const cleanup = () => {
        URL.revokeObjectURL(url)
        video.remove()
      }

      // Try to seek to a small offset to get a real frame, not a black frame
      video.onloadedmetadata = () => {
        try {
          // Seek to 0.1s to skip black initial frames
          video.currentTime = Math.min(0.1, video.duration / 2 || 0.1)
        } catch {
          /* ignore */
        }
      }

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas')
          // Limit size to keep thumbnail small (max 720px on the longer side)
          const maxSize = 720
          const ratio = video.videoWidth / video.videoHeight
          let w = video.videoWidth
          let h = video.videoHeight
          if (w > maxSize || h > maxSize) {
            if (ratio > 1) {
              w = maxSize
              h = Math.round(maxSize / ratio)
            } else {
              h = maxSize
              w = Math.round(maxSize * ratio)
            }
          }
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            cleanup()
            resolve(null)
            return
          }
          ctx.drawImage(video, 0, 0, w, h)
          canvas.toBlob(
            (blob) => {
              cleanup()
              resolve(blob)
            },
            'image/jpeg',
            0.85
          )
        } catch (err) {
          console.warn('Thumbnail generation failed:', err)
          cleanup()
          resolve(null)
        }
      }

      video.onerror = () => {
        console.warn('Video failed to load for thumbnail generation')
        cleanup()
        resolve(null)
      }

      // Safety timeout — if seeking takes too long (some webm files), give up
      setTimeout(() => {
        cleanup()
        resolve(null)
      }, 8000)
    } catch (err) {
      console.warn('Thumbnail generation crashed:', err)
      resolve(null)
    }
  })
}
