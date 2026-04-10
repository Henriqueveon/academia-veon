import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestPushPermissionAndSubscribe(): Promise<{
  ok: boolean
  reason?: string
}> {
  if (!isPushSupported()) {
    return { ok: false, reason: 'unsupported' }
  }

  if (!VAPID_PUBLIC_KEY) {
    return { ok: false, reason: 'missing-vapid-key' }
  }

  // 1. Ask permission
  let permission = Notification.permission
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }
  if (permission !== 'granted') {
    return { ok: false, reason: 'denied' }
  }

  // 2. Get service worker registration
  const reg = await navigator.serviceWorker.ready

  // 3. Get existing subscription or create new
  let subscription = await reg.pushManager.getSubscription()
  if (!subscription) {
    try {
      const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key as BufferSource,
      })
    } catch (err) {
      console.error('Subscribe failed:', err)
      return { ok: false, reason: 'subscribe-failed' }
    }
  }

  // 4. Send to backend (Supabase RPC)
  const json = subscription.toJSON()
  const endpoint = subscription.endpoint
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth

  if (!p256dh || !auth) {
    return { ok: false, reason: 'missing-keys' }
  }

  const { error } = await supabase.rpc('save_push_subscription', {
    sub_endpoint: endpoint,
    sub_p256dh: p256dh,
    sub_auth: auth,
    sub_ua: navigator.userAgent.slice(0, 500),
  })

  if (error) {
    console.error('Failed to save subscription:', error)
    return { ok: false, reason: 'save-failed' }
  }

  return { ok: true }
}

export async function unsubscribePush(): Promise<void> {
  if (!isPushSupported()) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    await sub.unsubscribe()
  }
}
