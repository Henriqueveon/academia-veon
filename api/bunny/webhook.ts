import type { VercelRequest, VercelResponse } from '@vercel/node'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
const BUNNY_CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME || 'vz-6d04ab5b-6ae.b-cdn.net'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const payload = req.body as any
  // Bunny sends: { VideoLibraryId, VideoGuid, Status, Event }
  if (payload?.Event !== 'video.encoding.finished' || !payload?.VideoGuid) {
    return res.status(200).json({ ignored: true })
  }

  const videoId: string = payload.VideoGuid

  // Match by videoId in URL path — resolution-agnostic
  const pageRes = await fetch(
    `${SUPABASE_URL}/rest/v1/post_pages?image_url=like.*${encodeURIComponent(videoId)}*&select=post_id&limit=1`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
  )

  if (!pageRes.ok) {
    console.error('Bunny webhook: failed to query post_pages', await pageRes.text())
    return res.status(500).json({ error: 'DB query failed' })
  }

  const pages = await pageRes.json()
  if (!Array.isArray(pages) || pages.length === 0) {
    console.warn('Bunny webhook: no post_page found for videoId', videoId)
    return res.status(200).json({ found: false })
  }

  const postId: string = pages[0].post_id

  // Mark the post as ready
  const updateRes = await fetch(
    `${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}&status=eq.uploading`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ status: 'ready' }),
    },
  )

  if (!updateRes.ok) {
    console.error('Bunny webhook: failed to update post status', await updateRes.text())
    return res.status(500).json({ error: 'DB update failed' })
  }

  return res.status(200).json({ ok: true, postId })
}
