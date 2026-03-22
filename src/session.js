// src/session.js
// Manages auth token and user data in localStorage

const SESSION_KEY = 'vb_session';
const USER_KEY = 'vb_user';

export const session = {
  token: localStorage.getItem(SESSION_KEY) || null,
  user: JSON.parse(localStorage.getItem(USER_KEY) || 'null'),

  save() {
    if (this.token) localStorage.setItem(SESSION_KEY, this.token);
    if (this.user) localStorage.setItem(USER_KEY, JSON.stringify(this.user));
  },

  set(token, user) {
    this.token = token;
    this.user = user;
    this.save();
  },

  clear() {
    this.token = null;
    this.user = null;
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(USER_KEY);
  },

  isLoggedIn() {
    return !!this.token && !!this.user;
  },
};

// Generate or retrieve a stable device ID for this browser/PWA install
export function getDeviceId() {
  let id = localStorage.getItem('vb_device_id');
  if (!id) {
    // Generate a random device ID — stays the same for this install
    id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('vb_device_id', id);
  }
  return id;
}
