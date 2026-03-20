import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

const BUNNY_API_KEY = process.env.BUNNY_API_KEY!
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { title } = req.body

  try {
    // Create video on Bunny
    const createRes = await fetch(
      `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos`,
      {
        method: 'POST',
        headers: {
          'AccessKey': BUNNY_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      }
    )

    if (!createRes.ok) {
      const err = await createRes.text()
      return res.status(500).json({ error: 'Failed to create video', details: err })
    }

    const video = await createRes.json()

    // Generate TUS auth signature for direct browser upload
    const expirationTime = Math.floor(Date.now() / 1000) + 3600 // 1 hour
    const signaturePayload = BUNNY_LIBRARY_ID + BUNNY_API_KEY + expirationTime + video.guid
    const signature = crypto.createHash('sha256').update(signaturePayload).digest('hex')

    return res.status(200).json({
      videoId: video.guid,
      libraryId: BUNNY_LIBRARY_ID,
      tusEndpoint: 'https://video.bunnycdn.com/tusupload',
      authSignature: signature,
      authExpire: expirationTime,
    })
  } catch (error) {
    console.error('Bunny API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
