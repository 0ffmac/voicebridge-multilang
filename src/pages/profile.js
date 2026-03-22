// src/pages/profile.js
import { API } from '../api/client.js';
import { LANGUAGES } from '../config.js';
import { session } from '../session.js';
import { getAvatarUrl, avatarImg } from '../avatar.js';

export function renderProfilePage(isNew = false) {
  const user = session.user;
  const avatarUrl = getAvatarUrl(user?.username || 'default');

  document.getElementById('app').innerHTML = `
    <div class="app">
      ${isNew ? '' : `
      <header>
        <button class="back-btn" onclick="window.router.go('translator')">‹</button>
        <div class="logo">Edit Profile</div>
        <div></div>
      </header>`}

      <div class="auth-screen" style="min-height:${isNew ? '100dvh' : 'auto'}; padding-top:${isNew ? '0' : '8px'}; align-items: flex-start; overflow-y: auto;">
        <div class="auth-card" style="margin-top:${isNew ? 'auto' : '0'}; margin-bottom: 24px;">

          ${isNew ? `
          <div class="auth-logo">Voice<span>Bridge</span></div>
          <div class="auth-subtitle">One last step — set up your profile</div>
          ` : ''}

          <!-- Live avatar preview -->
          <div class="avatar-preview-wrap">
            <div class="avatar-preview" id="avatarPreview">
              ${avatarUrl
                ? `<img src="${avatarUrl}" class="avatar-preview-img" />`
                : `<div class="avatar-preview-fallback">${(user?.display_name || 'U')[0].toUpperCase()}</div>`
              }
            </div>
            ${isNew ? '<div class="avatar-preview-hint">Your avatar is generated from your username</div>' : ''}
          </div>

          <div class="field">
            <label>Display name</label>
            <input type="text" id="displayNameInput"
              placeholder="Your name"
              value="${user?.display_name || ''}"
              maxlength="40"
              oninput="autoFillUsername(this.value)" />
          </div>

          <div class="field">
            <label>Username <span style="color:var(--muted)">(@handle)</span></label>
            <input type="text" id="usernameInput"
              placeholder="yourhandle"
              value="${isNew ? '' : (user?.username || '')}"
              maxlength="30"
              oninput="updateAvatarPreview(this.value); this.dataset.manuallyEdited='true';" />
          </div>

          <div class="field">
            <label>Your language</label>
            <select id="languageSelect">
              ${LANGUAGES.map(l => `
                <option value="${l.code}" ${l.code === (user?.language || 'en') ? 'selected' : ''}>
                  ${l.flag} ${l.label}
                </option>
              `).join('')}
            </select>
          </div>

          <button class="primary-btn" onclick="handleSaveProfile()">
            ${isNew ? 'Get Started →' : 'Save Changes'}
          </button>

          ${!isNew ? `
          <button class="ghost-btn" onclick="window.router.go('translator')">Cancel</button>

          <div style="margin-top:32px; border-top:1px solid var(--border); padding-top:20px;">
            <div style="font-size:0.75rem; color:var(--muted); margin-bottom:12px; text-transform:uppercase; letter-spacing:0.1em;">
              Danger Zone
            </div>
            <button class="danger-btn" onclick="confirmDeleteAccount()">🗑 Delete Account</button>
          </div>
          ` : ''}

          <div class="error-msg" id="profileError"></div>
        </div>
      </div>
    </div>

    <!-- Delete account modal -->
    <div class="modal-overlay" id="deleteModal" style="display:none">
      <div class="modal-card">
        <div class="modal-icon">⚠️</div>
        <div class="modal-title">Delete Account?</div>
        <div class="modal-body">
          This will permanently delete your account, all messages, and all friend connections.
          <strong>This cannot be undone.</strong>
        </div>
        <button class="danger-btn" onclick="handleDeleteAccount()">Yes, delete everything</button>
        <button class="ghost-btn" onclick="closeModal()">Cancel</button>
      </div>
    </div>
  `;
}

// Live avatar preview as user types username
window.updateAvatarPreview = (username) => {
  const preview = document.getElementById('avatarPreview');
  if (!preview) return;
  const url = getAvatarUrl(username || 'default');
  if (url) {
    preview.innerHTML = `<img src="${url}" class="avatar-preview-img" />`;
  } else {
    preview.innerHTML = `<div class="avatar-preview-fallback">${(username || 'U')[0].toUpperCase()}</div>`;
  }
};

window.autoFillUsername = (displayName) => {
  const usernameInput = document.getElementById('usernameInput');
  if (!usernameInput) return;

  // Only auto-fill if user hasn't manually edited the username field
  if (usernameInput.dataset.manuallyEdited === 'true') return;

  // Convert display name to valid username:
  // lowercase, replace spaces and special chars with underscore,
  // remove anything that's not a-z, 0-9 or underscore
  const slug = displayName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .substring(0, 28); // leave room for potential suffix

  usernameInput.value = slug;
  updateAvatarPreview(slug); // update avatar live
};

window.handleSaveProfile = async () => {
  const display_name = document.getElementById('displayNameInput').value.trim();
  const username = document.getElementById('usernameInput').value.trim().toLowerCase();
  const language = document.getElementById('languageSelect').value;

  if (!display_name) return showProfileError('Please enter your name');
  if (!username || username.length < 3) return showProfileError('Username must be at least 3 characters');
  if (!/^[a-z0-9_]+$/.test(username)) return showProfileError('Username: letters, numbers and underscores only');

  try {
    await API.put('/api/users/me', { display_name, username, language });
    session.user = { ...session.user, display_name, username, language };
    session.save();
    showAfterSavePrompt();
  } catch (err) {
    showProfileError(err.message);
  }
};

function showAfterSavePrompt() {
  // Remove any existing sheet
  document.getElementById('afterSaveSheet')?.remove();

  const sheet = document.createElement('div');
  sheet.id = 'afterSaveSheet';

  Object.assign(sheet.style, {
    position: 'fixed',
    bottom: '0',
    left: '0',
    right: '0',
    background: '#0d1428',
    borderTop: '2px solid #38bdf8',
    borderRadius: '20px 20px 0 0',
    padding: '28px 24px 48px',
    zIndex: '99999',
    boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
  });

  sheet.innerHTML = `
    <p style="font-size:32px;text-align:center;margin:0 0 12px">👥</p>
    <p style="font-size:17px;font-weight:bold;color:#e2e8f0;
              text-align:center;margin:0 0 8px">
      Profile saved!
    </p>
    <p style="font-size:14px;color:#94a3b8;text-align:center;
              line-height:1.6;margin:0 0 24px">
      Would you like to find friends<br>and start a conversation?
    </p>
    <button id="goContactsBtn"
      style="display:block;width:100%;background:#38bdf8;color:#000;
             border:none;border-radius:12px;padding:15px;font-size:16px;
             font-weight:bold;cursor:pointer;margin-bottom:12px">
      👥 Find Friends
    </button>
    <button id="goTranslatorBtn"
      style="display:block;width:100%;background:transparent;
             color:#64748b;border:1px solid #1e3a5f;border-radius:12px;
             padding:13px;font-size:14px;cursor:pointer">
      Go to Translator
    </button>
  `;

  document.body.appendChild(sheet);

  document.getElementById('goContactsBtn').addEventListener('click', () => {
    sheet.remove();
    window.router.go('contacts');
  });

  document.getElementById('goTranslatorBtn').addEventListener('click', () => {
    sheet.remove();
    window.router.go('translator');
  });
}

window.confirmDeleteAccount = () => {
  document.getElementById('deleteModal').style.display = 'flex';
};

window.closeModal = () => {
  document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
};

window.handleDeleteAccount = async () => {
  try {
    await API.delete('/api/users/me');
    session.clear();
    window.router.go('translator');
  } catch (err) {
    closeModal();
    showProfileError('Failed to delete account: ' + err.message);
  }
};

function showProfileError(msg) {
  const el = document.getElementById('profileError');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
}
