import type { VercelRequest, VercelResponse } from '@vercel/node'
import webpush from 'web-push'

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY!
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contato@academiaveon.com.br'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

interface SendBody {
  user_ids: string[]
  title: string
  body: string
  url?: string
  tag?: string
}

async function fetchSubscriptionsForUsers(userIds: string[]) {
  const url = `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=in.(${userIds.join(',')})&select=endpoint,p256dh,auth,user_id,id`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
    },
  })
  if (!res.ok) return []
  return await res.json()
}

async function deleteSubscription(id: string) {
  const url = `${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${id}`
  await fetch(url, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
    },
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { user_ids, title, body, url, tag } = (req.body || {}) as SendBody

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ error: 'user_ids required' })
    }
    if (!title || !body) {
      return res.status(400).json({ error: 'title and body required' })
    }

    const subscriptions = await fetchSubscriptionsForUsers(user_ids)
    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      return res.status(200).json({ sent: 0, message: 'No subscriptions for these users' })
    }

    const payload = JSON.stringify({ title, body, url: url || '/', tag: tag || 'academia-veon' })

    let sent = 0
    let removed = 0

    await Promise.all(
      subscriptions.map(async (sub: any) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          )
          sent++
        } catch (err: any) {
          // 410 Gone or 404 Not Found = subscription invalid, remove it
          if (err.statusCode === 404 || err.statusCode === 410) {
            await deleteSubscription(sub.id)
            removed++
          } else {
            console.warn('Push send failed:', err.statusCode || err.message)
          }
        }
      })
    )

    return res.status(200).json({ sent, removed, total: subscriptions.length })
  } catch (error: any) {
    console.error('Push send error:', error)
    return res.status(500).json({ error: 'Failed to send', details: error.message })
  }
}
