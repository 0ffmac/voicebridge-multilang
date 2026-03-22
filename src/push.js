// src/push.js
import { API } from './api/client.js';
import { session } from './session.js';

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'OPEN_CHAT' && window.router) {
        window.router.go('chat', {
          friendId: event.data.friendId,
          friendName: event.data.friendName,
          friendLang: 'en',
        });
      }
    });
    return reg;
  } catch (err) {
    console.warn('SW registration failed:', err);
    return null;
  }
}

export async function requestPushPermission() {
  if (!session.isLoggedIn()) return false;
  if (!('Notification' in window) || !('PushManager' in window)) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  return subscribeToPush();
}

export async function subscribeToPush() {
  if (!session.isLoggedIn()) return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  try {
    console.log('Starting push subscription process...');
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('SW ready timeout')), 5000))
    ]);

    let existing = await reg.pushManager.getSubscription();
    if (existing) {
      console.log('Existing push subscription found, saving to server...');
      await API.post('/api/push/subscribe', existing.toJSON());
      return true;
    }

    console.log('Fetching VAPID key from server...');
    const resp = await API.get('/api/push/vapid-public-key');
    if (!resp.key) {
      console.error('VAPID_PUBLIC_KEY not set on server');
      return false;
    }

    console.log('Creating fresh subscription...');
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(resp.key),
    });

    console.log('Saving new subscription to server...');
    await API.post('/api/push/subscribe', subscription.toJSON());
    console.log('Push subscription successfully updated ✅');
    return true;

  } catch (err) {
    console.error('subscribeToPush error:', err);
    return false;
  }
}

export async function unsubscribeFromPush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await API.delete('/api/push/subscribe', { endpoint: sub.endpoint });
    await sub.unsubscribe();
  } catch (err) {
    console.warn('Unsubscribe failed:', err);
  }
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getPushPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}
