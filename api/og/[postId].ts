import type { VercelRequest, VercelResponse } from '@vercel/node'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || ''

const DEFAULT_TITLE = 'Academia Veon — Comunidade'
const DEFAULT_DESCRIPTION = 'Confira esse conteúdo exclusivo da Academia Veon. Treinamentos, comunidade e crescimento profissional.'
const DEFAULT_IMAGE = 'https://academia-veon.vercel.app/og-default.jpg'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

async function fetchFromSupabase(path: string) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  })
  if (!res.ok) return null
  return await res.json()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { postId } = req.query
  const id = Array.isArray(postId) ? postId[0] : postId

  // Defaults
  let title = DEFAULT_TITLE
  let description = DEFAULT_DESCRIPTION
  let image = DEFAULT_IMAGE
  let authorName = 'Academia Veon'

  if (id && SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      // Fetch post
      const posts = await fetchFromSupabase(`posts?id=eq.${id}&select=id,user_id,caption`)
      const post = Array.isArray(posts) && posts.length > 0 ? posts[0] : null

      if (post) {
        // Fetch author profile
        const profiles = await fetchFromSupabase(
          `profiles?id=eq.${post.user_id}&select=name,avatar_url`
        )
        const profile = Array.isArray(profiles) && profiles.length > 0 ? profiles[0] : null
        if (profile?.name) {
          authorName = profile.name
        }

        // Fetch first page (image/video/audio)
        const pages = await fetchFromSupabase(
          `post_pages?post_id=eq.${id}&order=sort_order.asc&limit=1`
        )
        const firstPage = Array.isArray(pages) && pages.length > 0 ? pages[0] : null

        // Build title
        title = `${authorName} — Academia Veon`

        // Build description from caption or fallback
        if (post.caption && post.caption.trim().length > 0) {
          description = post.caption.trim().slice(0, 200)
        } else {
          description = `Confira o post de ${authorName} na Academia Veon`
        }

        // Build image: use post image, video thumbnail (best effort), or fallback
        if (firstPage?.image_url) {
          if (firstPage.type === 'image') {
            image = firstPage.image_url
          } else if (firstPage.type === 'video') {
            // For videos, use the URL itself — Open Graph supports og:video too
            // For preview image, fall back to default until we have thumbnails
            image = profile?.avatar_url || DEFAULT_IMAGE
          } else if (firstPage.type === 'audio') {
            image = profile?.avatar_url || DEFAULT_IMAGE
          }
        } else if (profile?.avatar_url) {
          image = profile.avatar_url
        }
      }
    } catch (err) {
      console.error('OG fetch error:', err)
      // Fall through with defaults
    }
  }

  const safeTitle = escapeHtml(title)
  const safeDescription = escapeHtml(description)
  const safeImage = escapeHtml(image)
  const safeUrl = `https://academia-veon.vercel.app/p/${id || ''}`

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}" />

  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Academia Veon" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:image" content="${safeImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="1500" />
  <meta property="og:url" content="${safeUrl}" />
  <meta property="og:locale" content="pt_BR" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDescription}" />
  <meta name="twitter:image" content="${safeImage}" />

  <!-- Redirect real users to the SPA after a moment (crawlers ignore this) -->
  <meta http-equiv="refresh" content="0; url=${safeUrl}" />
  <link rel="canonical" href="${safeUrl}" />
  <script>
    // Immediate JS redirect for browsers (crawlers don't run JS)
    window.location.replace(${JSON.stringify(safeUrl)});
  </script>
</head>
<body style="font-family: -apple-system, sans-serif; background: #0a0e1a; color: #fff; text-align: center; padding: 40px 20px;">
  <h1>${safeTitle}</h1>
  <p>${safeDescription}</p>
  <p><a href="${safeUrl}" style="color: #e63946;">Abrir na Academia Veon</a></p>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
  res.status(200).send(html)
}
