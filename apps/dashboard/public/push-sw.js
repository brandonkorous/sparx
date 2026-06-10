// Web Push service worker for the Sparx dashboard (docs/69 A-6).
//
// `push`            → show the notification (push-worker sends { title, body, url, tag }).
// `notificationclick` → focus an existing dashboard tab and navigate it to the
//                       target URL, or open a new one.

/* global self, clients */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || 'Sparx';
  const options = {
    body: data.body || '',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || '/' },
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
