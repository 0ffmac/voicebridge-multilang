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
