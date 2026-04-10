// Academia Veon — Service Worker for PWA + Push Notifications

const CACHE_NAME = 'academia-veon-v1'

self.addEventListener('install', (event) => {
  // Activate immediately
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Take control of all clients immediately
  event.waitUntil(self.clients.claim())
})

// Push notification received
self.addEventListener('push', (event) => {
  let data = {
    title: 'Academia Veon',
    body: 'Você tem uma nova notificação',
    url: '/',
  }

  try {
    if (event.data) {
      const parsed = event.data.json()
      data = { ...data, ...parsed }
    }
  } catch (err) {
    // ignore parse errors
  }

  const options = {
    body: data.body,
    icon: '/icon.svg',
    badge: '/icon.svg',
    vibrate: [200, 100, 200],
    tag: data.tag || 'academia-veon',
    renotify: true,
    data: { url: data.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

// Notification clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // If a window is already open, focus it and navigate
      for (const client of clients) {
        if ('focus' in client) {
          client.focus()
          if ('navigate' in client) {
            try {
              client.navigate(url)
            } catch {
              /* ignore */
            }
          }
          return
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    })
  )
})
