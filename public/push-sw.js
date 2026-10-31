self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data?.json() ?? {}; } catch { payload = { body: event.data?.text() ?? '' }; }
  const title = payload.title || 'Pengingat tugas';
  const options = {
    body: payload.body || 'Ada tugas yang mendekati tenggat.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || 'taskpulse-reminder',
    data: { url: payload.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => client.url === target);
    return existing ? existing.focus() : self.clients.openWindow(target);
  }));
});
