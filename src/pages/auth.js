// src/pages/auth.js
import { API } from '../api/client.js';
import { session } from '../session.js';

export function renderAuthPage(redirectPage = 'contacts', redirectParams = {}) {
  window._authRedirect = { page: redirectPage, params: redirectParams };

  document.getElementById('app').innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-logo">Voice<span>Bridge</span></div>
        <div class="auth-subtitle">Login to access contacts & messaging.</div>

        <div id="authForm">
          <div class="auth-steps">
            <div class="auth-step active" id="step1">
              <div class="step-num">1</div>
              <div class="step-label">Enter email</div>
            </div>
            <div class="auth-step-line"></div>
            <div class="auth-step" id="step2">
              <div class="step-num">2</div>
              <div class="step-label">Check inbox</div>
            </div>
            <div class="auth-step-line"></div>
            <div class="auth-step" id="step3">
              <div class="step-num">3</div>
              <div class="step-label">You're in!</div>
            </div>
          </div>

          <div class="field">
            <label>Your email address</label>
            <input type="email" id="emailInput"
              placeholder="you@example.com"
              autocomplete="email"
              onkeydown="if(event.key==='Enter') handleSendLink()" />
          </div>
          <button class="primary-btn" id="sendLinkBtn" onclick="handleSendLink()">
            Send Magic Link ✉️
          </button>
          <button class="ghost-btn" onclick="window.router.go('translator')">
            ← Back to Translator
          </button>
          <div class="auth-note">No password needed — we'll email you a secure login link.</div>
        </div>

        <div id="authSent" style="display:none">
          <div class="auth-steps">
            <div class="auth-step done" id="step1s">
              <div class="step-num">✓</div>
              <div class="step-label">Email sent</div>
            </div>
            <div class="auth-step-line active"></div>
            <div class="auth-step active" id="step2s">
              <div class="step-num">2</div>
              <div class="step-label">Check inbox</div>
            </div>
            <div class="auth-step-line"></div>
            <div class="auth-step" id="step3s">
              <div class="step-num">3</div>
              <div class="step-label">You're in!</div>
            </div>
          </div>

          <div class="sent-icon">📬</div>
          <div class="sent-title">Check your email!</div>
          <div class="sent-msg">
            We sent a magic link to<br>
            <strong id="sentEmail"></strong>
          </div>
          <div class="countdown-wrap">
            Link expires in <span id="countdown">15:00</span>
          </div>
          <button class="ghost-btn" onclick="showAuthForm()">← Use a different email</button>
          <button class="ghost-btn" onclick="window.router.go('translator')">← Back to Translator</button>
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
    startCountdown();
  } catch (err) {
    showAuthError(err.message);
    btn.textContent = 'Send Magic Link ✉️';
    btn.disabled = false;
  }
};

window.showAuthForm = () => {
  document.getElementById('authForm').style.display = 'block';
  document.getElementById('authSent').style.display = 'none';
  stopCountdown();
};

// 15 min countdown timer
let countdownInterval = null;

function startCountdown() {
  stopCountdown();
  let seconds = 15 * 60;
  const el = document.getElementById('countdown');
  countdownInterval = setInterval(() => {
    if (!el) { stopCountdown(); return; }
    seconds--;
    if (seconds <= 0) {
      stopCountdown();
      el.textContent = 'expired';
      el.style.color = 'var(--danger)';
      return;
    }
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    if (seconds < 60) el.style.color = 'var(--danger)';
  }, 1000);
}

function stopCountdown() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
}

function showAuthError(msg) {
  const el = document.getElementById('authError');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
}
