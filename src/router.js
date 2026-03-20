// src/router.js
import { session } from './session.js';
import { API } from './api/client.js';
import { renderAuthPage } from './pages/auth.js';
import { renderProfilePage } from './pages/profile.js';
import { renderContactsPage } from './pages/contacts.js';
import { renderChatPage } from './pages/chat.js';

export const router = {
  async init() {
    // Check for magic link token in URL
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');

    if (token) {
      await handleMagicLink(token);
      return;
    }

    // Route based on auth state
    if (!session.isLoggedIn()) {
      renderAuthPage();
      return;
    }

    this.go('translator');
  },

  go(page, params = {}) {
    if (!session.isLoggedIn() && page !== 'auth') {
      renderAuthPage();
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
    session.set(data.session_token, data.user);

    // Clean token from URL
    window.history.replaceState({}, '', '/');

    if (data.is_new_user) {
      router.go('profile', { isNew: true });
    } else {
      router.go('translator');
    }
  } catch (err) {
    document.getElementById('app').innerHTML = `
      <div class="auth-screen">
        <div class="auth-card">
          <div class="auth-logo">Voice<span>Bridge</span></div>
          <div class="auth-subtitle" style="color:var(--danger)">
            Login link expired or already used.<br>
            <button class="ghost-btn" onclick="window.router.go('auth')" style="margin-top:16px">
              Try again
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

// Translator page — your existing UI rendered into #app
function renderTranslatorPage() {
  // Import dynamically to avoid circular deps
  import('./translatorPage.js').then(m => m.renderTranslatorPage());
}
