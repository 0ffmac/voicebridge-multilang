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

      <div class="auth-screen" style="min-height:${isNew ? '100dvh' : 'auto'}; padding-top:${isNew ? '0' : '8px'}">
        <div class="auth-card" style="margin-top:${isNew ? 'auto' : '0'}">

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
              maxlength="40" />
          </div>

          <div class="field">
            <label>Username <span style="color:var(--muted)">(@handle)</span></label>
            <input type="text" id="usernameInput"
              placeholder="yourhandle"
              value="${isNew ? '' : (user?.username || '')}"
              maxlength="30"
              oninput="updateAvatarPreview(this.value)" />
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
    window.router.go('translator');
  } catch (err) {
    showProfileError(err.message);
  }
};

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
