import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

let ffmpegInstance: FFmpeg | null = null
let loadPromise: Promise<FFmpeg> | null = null

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const ff = new FFmpeg()
    const base = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
    await ff.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    ffmpegInstance = ff
    return ff
  })()

  return loadPromise
}

export async function transcodeWebmToMp4(
  blob: Blob,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  const ff = await getFFmpeg()

  const handler = onProgress
    ? ({ progress }: { progress: number }) => onProgress(Math.min(99, Math.round(progress * 100)))
    : null
  if (handler) ff.on('progress', handler)

  try {
    await ff.writeFile('input.webm', await fetchFile(blob))
    await ff.exec([
      '-i', 'input.webm',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '28',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      'output.mp4',
    ])
    const data = await ff.readFile('output.mp4')
    await ff.deleteFile('input.webm')
    await ff.deleteFile('output.mp4')
    return new Blob([new Uint8Array(data as Uint8Array)], { type: 'video/mp4' })
  } finally {
    if (handler) ff.off('progress', handler)
  }
}
