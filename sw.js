// sw.js
self.addEventListener('push', (event) => {
  console.log('[SW] Push Event Received');
  
  let promise;
  if (event.data) {
    try {
      const data = event.data.json();
      console.log('[SW] Push Data:', data);
      promise = self.registration.showNotification(data.title || 'VoiceBridge', {
        body: data.body || 'New message',
        icon: '/public/icon-192.png',
        badge: '/public/badge-72.png',
        vibrate: [100, 50, 100],
        data: { friendId: data.friendId }
      });
    } catch (e) {
      console.error('[SW] Push Data Parse Error:', e);
      promise = self.registration.showNotification('VoiceBridge', {
        body: 'New message received',
        icon: '/public/icon-192.png'
      });
    }
  } else {
    console.warn('[SW] Push Event had no data');
    promise = self.registration.showNotification('VoiceBridge', {
      body: 'New message received',
      icon: '/public/icon-192.png'
    });
  }

  event.waitUntil(promise);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) return clientList[0].focus();
      return clients.openWindow('/');
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));
