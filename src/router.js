// src/router.js
import { session, getDeviceId } from './session.js';
import { API } from './api/client.js';
import { renderAuthPage } from './pages/auth.js';
import { renderProfilePage } from './pages/profile.js';
import { renderContactsPage } from './pages/contacts.js';
import { renderChatPage } from './pages/chat.js';

export const router = {
  async init() {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');

    if (token) {
      await handleMagicLink(token);
      return;
    }

    // If not logged in, check if there's a pending session to claim
    // (iOS PWA: user verified magic link in Safari, now opened the PWA)
    if (!session.isLoggedIn()) {
      const claimed = await tryClaimSession();
      if (claimed) return;
    }

    this.go('translator');
  },

  go(page, params = {}) {
    // Only contacts and chat require login
    const requiresAuth = ['contacts', 'chat', 'profile'];
    if (requiresAuth.includes(page) && !session.isLoggedIn()) {
      renderAuthPage(page, params); // remember where to go after login
      return;
    }

    switch (page) {
      case 'auth':
        renderAuthPage();
        break;
      case 'profile':
        renderProfilePage(params.isNew || false);
        break;
      case 'contacts':
        renderContactsPage();
        break;
      case 'chat':
        renderChatPage(params);
        break;
      case 'translator':
      default:
        renderTranslatorPage();
        break;
    }
  },
};

async function handleMagicLink(token) {
  const isIOSPWA = window.navigator.standalone === true;
  const isAndroidPWA = window.matchMedia('(display-mode: standalone)').matches;
  const isPWA = isIOSPWA || isAndroidPWA;
  const isIOSSafari = window.navigator.standalone === false;

  document.getElementById('app').innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-logo">Voice<span>Bridge</span></div>
        <div class="auth-subtitle">Logging you in...</div>
      </div>
    </div>
  `;

  try {
    const data = await API.get(`/api/auth/verify?token=${token}`);
    window.history.replaceState({}, '', '/');

    if (isIOSSafari && !isPWA) {
      // iOS Safari — session is stored in KV against device_id.
      // Tell user to open the PWA from Home Screen.
      // When they do, tryClaimSession() will fetch it automatically.
      document.getElementById('app').innerHTML = `
        <div class="auth-screen">
          <div class="auth-card">
            <div class="auth-logo">Voice<span>Bridge</span></div>
            <div class="auth-subtitle" style="color:var(--accent3)">
              ✅ Login successful!
            </div>
            <div style="margin-top:20px;font-size:0.95rem;color:var(--text);
                        text-align:center;line-height:1.8;">
              Now open VoiceBridge from your<br>
              <strong style="font-size:1.1rem;">Home Screen icon</strong><br>
              — you'll be logged in automatically.
            </div>
            <div style="margin-top:20px;font-size:3.5rem;text-align:center;">
              📱
            </div>
            <div style="margin-top:12px;font-size:0.75rem;color:var(--muted);
                        text-align:center;line-height:1.6;">
              This link is valid for 5 minutes.
            </div>
          </div>
        </div>
      `;
      return;
    }

    // PWA or Android/Desktop — normal flow
    session.set(data.session_token, data.user);

    if (data.is_new_user) {
      router.go('profile', { isNew: true });
    } else {
      const redirect = window._authRedirect || { page: 'contacts', params: {} };
      window._authRedirect = null;
      router.go(redirect.page, redirect.params);
    }

  } catch (err) {
    document.getElementById('app').innerHTML = `
      <div class="auth-screen">
        <div class="auth-card">
          <div class="auth-logo">Voice<span>Bridge</span></div>
          <div class="auth-subtitle" style="color:var(--danger)">
            Login link expired or already used.<br>
            <button class="ghost-btn" onclick="window.router.go('auth')"
              style="margin-top:16px">Try again</button>
          </div>
        </div>
      </div>
    `;
  }
}

// Try to claim a session that was verified in Safari (iOS PWA flow)
async function tryClaimSession() {
  try {
    const device_id = getDeviceId();
    const data = await API.get(`/api/auth/claim-session?device_id=${device_id}`);
    if (data.session_token && data.user) {
      session.set(data.session_token, data.user);
      console.log('Session claimed from Safari handshake ✅');
      if (data.is_new_user) {
        router.go('profile', { isNew: true });
      } else {
        router.go('contacts');
      }
      return true;
    }
  } catch(e) {
    // 404 = no pending session, that's normal — just continue
    if (!e.message?.includes('404') && !e.message?.includes('No pending session')) {
      console.warn('claimSession error:', e.message);
    }
  }
  return false;
}

// Translator page — your existing UI rendered into #app
function renderTranslatorPage() {
  // Import dynamically to avoid circular deps
  import('./translatorPage.js').then(m => m.renderTranslatorPage());
}
