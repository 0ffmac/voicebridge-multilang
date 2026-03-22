// src/translatorPage.js
import { session } from './session.js';
import { avatarImg } from './avatar.js';
import { isPushSupported, getPushPermission, subscribeToPush } from './push.js';

export function renderTranslatorPage() {
  const isLoggedIn = session.isLoggedIn();

  // Only show banner if permission has never been asked ('default')
  const permission = isPushSupported() ? getPushPermission() : 'unsupported';
  const showPushBanner = isLoggedIn && permission === 'default';

  document.getElementById('app').innerHTML = `
    <div class="app">
      <header>
        <div class="logo">Voice<span>Bridge</span></div>
        <div class="header-actions">
          <button class="icon-btn" onclick="window.router.go('contacts')" title="Contacts">👥</button>
          ${isLoggedIn
            ? `<button class="icon-btn" onclick="window.router.go('profile')" title="Profile">
                 ${avatarImg(session.user?.username, 28, 'header-avatar')}
               </button>
               <button class="icon-btn" onclick="handleLogout()" title="Logout">⏏</button>`
            : `<button class="icon-btn" onclick="window.router.go('auth')" title="Login">🔑</button>`
          }
        </div>
      </header>

      <div class="error-msg" id="errorMsg"></div>

      <div class="lang-bar">
        <select class="lang-select" id="srcSelect" onchange="onSourceLangChange(this.value)"></select>
        <button class="swap-btn" onclick="onSwapLanguage()" title="Swap">⇄</button>
        <select class="lang-select" id="tgtSelect" onchange="onTargetLangChange(this.value)"></select>
      </div>

      <div class="card" id="inputCard">
        <div class="card-label">// YOU SAID</div>
        <div class="card-text placeholder" id="inputText">Tap the mic and speak...</div>
        <div class="card-actions">
          <button class="icon-btn" onclick="clearAll()">✕ Clear</button>
        </div>
      </div>

      <div class="card result-card" id="outputCard">
        <div class="card-label">// TRANSLATION</div>
        <div class="card-text placeholder" id="outputText">Translation will appear here...</div>
        <div class="card-actions">
          <button class="icon-btn" onclick="speakOutput()">▶ Replay</button>
          <button class="icon-btn" onclick="copyOutput()">⎘ Copy</button>
        </div>
      </div>

      <div class="mic-section">
        <div class="mic-status" id="micStatus">Tap to speak</div>
        <div class="waveform" id="waveform">
          <div class="wave-bar" style="height:8px"></div>
          <div class="wave-bar" style="height:14px"></div>
          <div class="wave-bar" style="height:22px"></div>
          <div class="wave-bar" style="height:18px"></div>
          <div class="wave-bar" style="height:28px"></div>
          <div class="wave-bar" style="height:18px"></div>
          <div class="wave-bar" style="height:22px"></div>
          <div class="wave-bar" style="height:14px"></div>
          <div class="wave-bar" style="height:8px"></div>
        </div>
        <div class="mic-outer">
          <div class="mic-ring" id="ring1"></div>
          <div class="mic-ring" id="ring2"></div>
          <div class="mic-ring" id="ring3"></div>
          <button class="mic-btn" id="micBtn" onclick="handleMic()">
            <span class="mic-icon" id="micIcon">🎙️</span>
          </button>
        </div>
      </div>
    </div>
  `;

  import('./app.js').then(m => m.initTranslator());

  // Show push sheet only if permission never asked
  if (showPushBanner) {
    showPushSheet();
  }

  // Already granted — just subscribe silently (saves to DB if not already saved)
  if (isLoggedIn && isPushSupported() && permission === 'granted') {
    subscribeToPush().catch(() => {});
  }
}

function showPushSheet() {
  document.getElementById('pushSheet')?.remove();

  const sheet = document.createElement('div');
  sheet.id = 'pushSheet';

  Object.assign(sheet.style, {
    position: 'fixed',
    bottom: '0',
    left: '0',
    right: '0',
    background: '#0d1428',
    borderTop: '3px solid #38bdf8',
    borderRadius: '20px 20px 0 0',
    padding: '32px 24px 48px',
    zIndex: '99999',
    boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
  });

  sheet.innerHTML = `
    <p style="font-size:40px;text-align:center;margin:0 0 16px">🔔</p>
    <p style="font-size:18px;font-weight:bold;color:#e2e8f0;
              text-align:center;margin:0 0 10px">Enable Notifications</p>
    <p style="font-size:14px;color:#94a3b8;text-align:center;
              line-height:1.6;margin:0 0 24px">
      Get notified when friends send you messages,<br>even when the app is closed.
    </p>
    <button id="pushEnableBtn"
      style="display:block;width:100%;background:#38bdf8;color:#000;
             border:none;border-radius:12px;padding:16px;font-size:16px;
             font-weight:bold;cursor:pointer;margin-bottom:12px">
      Enable Notifications
    </button>
    <button id="pushDismissBtn"
      style="display:block;width:100%;background:transparent;
             color:#64748b;border:1px solid #1e3a5f;border-radius:12px;
             padding:14px;font-size:14px;cursor:pointer">
      Not now
    </button>
  `;

  document.body.appendChild(sheet);

  document.getElementById('pushEnableBtn').addEventListener('click', window.handleEnablePush);
  document.getElementById('pushDismissBtn').addEventListener('click', window.dismissPushBanner);
}

window.handleLogout = async () => {
  try {
    const { API } = await import('./api/client.js');
    await API.post('/api/auth/logout', {});
  } catch(e) {}
  const { session } = await import('./session.js');
  session.clear();
  window.router.go('translator');
};
