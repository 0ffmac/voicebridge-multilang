// src/translatorPage.js
// Wraps the existing translator UI as a routable page
import { session } from './session.js';

export function renderTranslatorPage() {
  document.getElementById('app').innerHTML = `
    <div class="app">
      <header>
        <div class="logo">Voice<span>Bridge</span></div>
        <div class="header-actions">
          <button class="icon-btn" onclick="window.router.go('contacts')" title="Contacts">👥</button>
          <button class="icon-btn" onclick="window.router.go('profile')" title="Profile">👤</button>
          <button class="icon-btn" onclick="handleLogout()" title="Logout">⏏</button>
        </div>
      </header>

      <div class="error-msg" id="errorMsg"></div>

      <!-- Language Bar -->
      <div class="lang-bar">
        <select class="lang-select" id="srcSelect" onchange="onSourceLangChange(this.value)"></select>
        <button class="swap-btn" onclick="onSwapLanguage()" title="Swap">⇄</button>
        <select class="lang-select" id="tgtSelect" onchange="onTargetLangChange(this.value)"></select>
      </div>

      <!-- Input Card -->
      <div class="card" id="inputCard">
        <div class="card-label">// YOU SAID</div>
        <div class="card-text placeholder" id="inputText">Tap the mic and speak...</div>
        <div class="card-actions">
          <button class="icon-btn" onclick="clearAll()">✕ Clear</button>
        </div>
      </div>

      <!-- Output Card -->
      <div class="card result-card" id="outputCard">
        <div class="card-label">// TRANSLATION</div>
        <div class="card-text placeholder" id="outputText">Translation will appear here...</div>
        <div class="card-actions">
          <button class="icon-btn" onclick="speakOutput()">▶ Replay</button>
          <button class="icon-btn" onclick="copyOutput()">⎘ Copy</button>
        </div>
      </div>

      <!-- Mic Section -->
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

  // Re-init translator state after DOM render
  import('./app.js').then(m => m.initTranslator());
}

window.handleLogout = async () => {
  try {
    const { API } = await import('./api/client.js');
    await API.post('/api/auth/logout', {});
  } catch(e) {}
  const { session } = await import('./session.js');
  session.clear();
  window.router.go('auth');
};
