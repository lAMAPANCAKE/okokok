// Gestione delle notifiche push, importata nel service worker generato da Workbox.
self.addEventListener('push', (event) => {
  let dati = {}
  try {
    dati = event.data ? event.data.json() : {}
  } catch {
    dati = { titolo: event.data ? event.data.text() : 'Nuova notifica' }
  }
  const titolo = dati.titolo || 'Gestionale Eventi'
  event.waitUntil(
    self.registration.showNotification(titolo, {
      body: dati.testo || '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: dati.id ? `notifica-${dati.id}` : undefined,
      data: { link: dati.link || '/notifiche' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destinazione = new URL(event.notification.data?.link || '/notifiche', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((finestre) => {
      for (const f of finestre) {
        if (f.url.startsWith(self.location.origin) && 'focus' in f) {
          f.navigate(destinazione)
          return f.focus()
        }
      }
      return self.clients.openWindow(destinazione)
    }),
  )
})
