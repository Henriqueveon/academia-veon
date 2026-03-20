import type { VercelRequest, VercelResponse } from '@vercel/node'

const BUNNY_API_KEY = process.env.BUNNY_API_KEY!
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { videoId } = req.query

  if (!videoId || typeof videoId !== 'string') {
    return res.status(400).json({ error: 'videoId is required' })
  }

  try {
    const deleteRes = await fetch(
      `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${videoId}`,
      {
        method: 'DELETE',
        headers: { 'AccessKey': BUNNY_API_KEY },
      }
    )

    if (!deleteRes.ok) {
      return res.status(500).json({ error: 'Failed to delete video' })
    }

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Bunny delete error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
