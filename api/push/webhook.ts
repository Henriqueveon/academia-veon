import type { VercelRequest, VercelResponse } from '@vercel/node'
import webpush from 'web-push'

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY!
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contato@academiaveon.com.br'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
const WEBHOOK_SECRET = process.env.PUSH_WEBHOOK_SECRET || ''

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

// Notification type → human readable text
function buildNotificationText(notification: any, actorName: string, extra?: string): { title: string; body: string; url: string } {
  const type = notification.type
  const post_id = notification.post_id
  const training_id = notification.training_id
  const lesson_id = notification.lesson_id

  switch (type) {
    case 'post_like':
      return { title: 'Academia Veon', body: `${actorName} curtiu seu post`, url: post_id ? `/p/${post_id}` : '/comunidade' }
    case 'post_comment':
      return { title: 'Academia Veon', body: `${actorName} comentou no seu post`, url: post_id ? `/p/${post_id}` : '/comunidade' }
    case 'comment_reply':
      return { title: 'Academia Veon', body: `${actorName} respondeu seu comentário`, url: post_id ? `/p/${post_id}` : '/comunidade' }
    case 'new_follower':
      return { title: 'Academia Veon', body: `${actorName} começou a te seguir`, url: notification.actor_id ? `/perfil/${notification.actor_id}` : '/comunidade' }
    case 'share_received':
      return { title: 'Academia Veon', body: `${actorName} compartilhou um post com você`, url: post_id ? `/p/${post_id}` : '/comunidade' }
    case 'followed_user_post':
      return { title: 'Academia Veon', body: `${actorName} publicou um novo post`, url: post_id ? `/p/${post_id}` : '/comunidade' }
    case 'new_post_feed':
      return { title: 'Academia Veon', body: 'Tem novo post no feed!', url: '/comunidade' }
    case 'training_released':
      return { title: 'Academia Veon 🎓', body: extra ? `O Treinamento ${extra} foi liberado para você, boas aulas!` : 'Um novo treinamento foi liberado para você, boas aulas!', url: training_id ? `/treinamentos/${training_id}` : '/treinamentos' }
    case 'new_lesson':
      return { title: 'Academia Veon', body: 'Nova aula disponível 🎓', url: lesson_id ? `/treinamentos?aula=${lesson_id}` : '/treinamentos' }
    case 'lead_interest':
      return { title: 'Novo lead 🔥', body: extra ? `${actorName} tem interesse em "${extra}"` : `${actorName} demonstrou interesse em um curso`, url: notification.actor_id ? `/perfil/${notification.actor_id}` : '/gestor/tripulantes' }
    case 'credit_received':
      return { title: 'Academia Veon 💰', body: extra || 'Você recebeu créditos!', url: '/creditos' }
    case 'post_blocked':
      return {
        title: 'Post removido',
        body: extra
          ? `Seu post foi removido da nossa Comunidade. Motivo: ${extra}`
          : 'Seu post foi removido da nossa Comunidade',
        url: '/comunidade',
      }
    case 'post_deleted_by_user':
      return {
        title: 'Academia Veon',
        body: `${actorName} apagou o post na Comunidade`,
        url: notification.actor_id ? `/perfil/${notification.actor_id}` : '/comunidade',
      }
    default:
      return { title: 'Academia Veon', body: 'Você tem uma nova notificação', url: '/comunidade' }
  }
}

async function fetchActor(id: string) {
  const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}&select=name`
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  return Array.isArray(data) && data.length > 0 ? data[0] : null
}

async function fetchTraining(id: string) {
  const url = `${SUPABASE_URL}/rest/v1/trainings?id=eq.${id}&select=title`
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  return Array.isArray(data) && data.length > 0 ? data[0] : null
}

async function fetchSubscriptions(userId: string) {
  const url = `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${userId}&select=endpoint,p256dh,auth,id`
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (!res.ok) return []
  return await res.json()
}

async function deleteSubscription(id: string) {
  const url = `${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${id}`
  await fetch(url, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Optional: validate webhook secret
  if (WEBHOOK_SECRET) {
    const auth = req.headers['x-webhook-secret'] || req.headers.authorization
    if (auth !== WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  try {
    const payload = req.body as any

    // Supabase webhook payload format: { type, table, record, old_record, schema }
    const notification = payload.record || payload
    if (!notification || !notification.user_id || !notification.type) {
      return res.status(400).json({ error: 'Invalid payload' })
    }

    // Fetch actor name
    let actorName = 'Alguém'
    if (notification.actor_id) {
      const actor = await fetchActor(notification.actor_id)
      if (actor?.name) actorName = actor.name
    }

    // Fetch training name or blocked_reason (if applicable)
    let extra: string | undefined
    if (notification.training_id) {
      const training = await fetchTraining(notification.training_id)
      if (training?.title) extra = training.title
    }
    if (notification.type === 'post_blocked' && notification.post_id) {
      const postUrl = `${SUPABASE_URL}/rest/v1/posts?id=eq.${notification.post_id}&select=blocked_reason`
      const pRes = await fetch(postUrl, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      })
      if (pRes.ok) {
        const pData = await pRes.json()
        if (Array.isArray(pData) && pData.length > 0 && pData[0].blocked_reason) {
          extra = pData[0].blocked_reason
        }
      }
    }

    const { title, body, url } = buildNotificationText(notification, actorName, extra)

    // Fetch user's push subscriptions
    const subscriptions = await fetchSubscriptions(notification.user_id)
    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      return res.status(200).json({ sent: 0, message: 'No subscriptions for this user' })
    }

    const pushPayload = JSON.stringify({ title, body, url, tag: notification.id || 'academia-veon' })

    let sent = 0
    let removed = 0

    await Promise.all(
      subscriptions.map(async (sub: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            pushPayload
          )
          sent++
        } catch (err: any) {
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
    console.error('Push webhook error:', error)
    return res.status(500).json({ error: 'Failed', details: error.message })
  }
}
