// src/pages/profile.js
import { API } from '../api/client.js';
import { LANGUAGES } from '../config.js';
import { session } from '../session.js';

export function renderProfilePage(isNew = false) {
  const user = session.user;

  document.getElementById('app').innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-logo">Voice<span>Bridge</span></div>
        <div class="auth-subtitle">${isNew ? 'Set up your profile' : 'Edit profile'}</div>

        <div class="field">
          <label>Display name</label>
          <input type="text" id="displayNameInput" placeholder="Your name"
            value="${user?.display_name || ''}" maxlength="40" />
        </div>

        <div class="field">
          <label>Username <span class="muted">(@handle)</span></label>
          <input type="text" id="usernameInput" placeholder="yourhandle"
            value="${user?.username || ''}" maxlength="30" />
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

        ${!isNew ? `<button class="ghost-btn" onclick="window.router.go('translator')">Cancel</button>` : ''}

        <div class="error-msg" id="profileError"></div>
      </div>
    </div>
  `;
}

window.handleSaveProfile = async () => {
  const display_name = document.getElementById('displayNameInput').value.trim();
  const username = document.getElementById('usernameInput').value.trim().toLowerCase();
  const language = document.getElementById('languageSelect').value;

  if (!display_name) return showProfileError('Please enter your name');
  if (!username || username.length < 3) return showProfileError('Username must be at least 3 characters');
  if (!/^[a-z0-9_]+$/.test(username)) return showProfileError('Username can only contain letters, numbers and underscores');

  try {
    await API.put('/api/users/me', { display_name, username, language });
    session.user = { ...session.user, display_name, username, language };
    session.save();
    window.router.go('translator');
  } catch (err) {
    showProfileError(err.message);
  }
};

function showProfileError(msg) {
  const el = document.getElementById('profileError');
  el.textContent = msg;
  el.classList.add('show');
}
