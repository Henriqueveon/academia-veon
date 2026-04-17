import type { VercelRequest, VercelResponse } from '@vercel/node'

const BUNNY_API_KEY = process.env.BUNNY_API_KEY!
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID!
const BUNNY_CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME!

const RESOLUTION_PRIORITY = ['1080p', '720p', '480p', '360p', '240p']

function bestResolutionUrl(videoId: string, availableResolutions: string | null): string {
  const available = (availableResolutions || '').split(',').map(r => r.trim()).filter(Boolean)
  const best = RESOLUTION_PRIORITY.find(r => available.includes(r)) ?? available[0] ?? '360p'
  return `https://${BUNNY_CDN_HOSTNAME}/${videoId}/play_${best}.mp4`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { videoId } = req.query
  if (!videoId || typeof videoId !== 'string') return res.status(400).json({ error: 'Missing videoId' })

  const bunnyRes = await fetch(
    `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${videoId}`,
    { headers: { AccessKey: BUNNY_API_KEY } },
  )

  if (!bunnyRes.ok) return res.status(502).json({ error: 'Bunny API error' })

  const data = await bunnyRes.json()
  // Bunny status: 0=Created, 1=Uploaded, 2=Processing, 3=Transcoding, 4=Finished, 5=Error, 6=UploadFailed
  const ready = data.status === 4
  return res.status(200).json({
    status: data.status,
    ready,
    failed: data.status === 5 || data.status === 6,
    bestUrl: ready ? bestResolutionUrl(videoId, data.availableResolutions) : null,
  })
}
