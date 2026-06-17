// Minimal service worker: shows signal notifications and focuses the app on click.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if ('focus' in client) return client.focus()
            }
            if (self.clients.openWindow) return self.clients.openWindow('/')
            return undefined
        })
    )
})
