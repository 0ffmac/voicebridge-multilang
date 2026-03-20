// src/pages/auth.js
import { API } from '../api/client.js';

export function renderAuthPage() {
  document.getElementById('app').innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-logo">Voice<span>Bridge</span></div>
        <div class="auth-subtitle">Translate. Connect. Communicate.</div>

        <div id="authForm">
          <div class="field">
            <label>Your email address</label>
            <input
              type="email"
              id="emailInput"
              placeholder="you@example.com"
              autocomplete="email"
            />
          </div>
          <button class="primary-btn" id="sendLinkBtn" onclick="handleSendLink()">
            Send Magic Link
          </button>
          <div class="auth-note">No password needed — we'll email you a login link.</div>
        </div>

        <div id="authSent" style="display:none">
          <div class="sent-icon">📬</div>
          <div class="sent-title">Check your email!</div>
          <div class="sent-msg">We sent a magic link to <strong id="sentEmail"></strong>.<br>Click it to log in.</div>
          <button class="ghost-btn" onclick="showAuthForm()">Use a different email</button>
        </div>

        <div class="error-msg" id="authError"></div>
      </div>
    </div>
  `;
}

window.handleSendLink = async () => {
  const email = document.getElementById('emailInput').value.trim();
  if (!email) return showAuthError('Please enter your email');

  const btn = document.getElementById('sendLinkBtn');
  btn.textContent = 'Sending...';
  btn.disabled = true;

  try {
    await API.post('/api/auth/send-link', { email });
    document.getElementById('sentEmail').textContent = email;
    document.getElementById('authForm').style.display = 'none';
    document.getElementById('authSent').style.display = 'block';
  } catch (err) {
    showAuthError(err.message);
    btn.textContent = 'Send Magic Link';
    btn.disabled = false;
  }
};

window.showAuthForm = () => {
  document.getElementById('authForm').style.display = 'block';
  document.getElementById('authSent').style.display = 'none';
};

function showAuthError(msg) {
  const el = document.getElementById('authError');
  el.textContent = msg;
  el.classList.add('show');
}
