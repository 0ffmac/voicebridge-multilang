// src/app.js
import { LANGUAGES } from './config.js';
import { state, swapLanguages } from './state.js';
import { fetchTranslation } from './translate.js';
import { speak, speakAsync, preloadVoices, unlockAudio } from './tts.js';
import { isIOS, buildRecognition, startListening, stopListening, destroyRecognition } from './recognition.js';
import {
  renderLangSelectors,
  setUIIdle, setUIProcessing, setUIReadyToSpeak, setUISuccess,
  setOutputText, clearCards,
  showError, hideError, showToast,
} from './ui.js';
import { router } from './router.js';
import { session } from './session.js';
import { registerServiceWorker, subscribeToPush, isPushSupported, requestPushPermission, getPushPermission } from './push.js';

// ─── Boot ─────────────────────────────────────────────────────────────────────
preloadVoices();
window.router = router;

// Register service worker immediately
registerServiceWorker();

router.init();

// Subscribe silently if permission already granted
if (session.isLoggedIn() && isPushSupported() && getPushPermission() === 'granted') {
  subscribeToPush().catch(() => {});
}

// ─── Push banner handlers — in app.js so always available ────────────────────
window.handleEnablePush = async () => {
  const sheet = document.getElementById('pushSheet');
  const banner = document.getElementById('pushBanner');
  const el = sheet || banner;
  if (el) el.innerHTML = `
    <div style="padding:24px; text-align:center; color:#94a3b8; font-family:sans-serif;">
      🔔 Requesting permission...
    </div>`;

  try {
    const granted = await requestPushPermission();
    if (el) {
      if (granted) {
        el.innerHTML = `<div style="padding:24px;text-align:center;color:#34d399;font-family:sans-serif;font-size:16px;">✅ Notifications enabled!</div>`;
        setTimeout(() => el?.remove(), 2000);
      } else {
        const perm = getPushPermission();
        el.innerHTML = `<div style="padding:24px;text-align:center;color:#f87171;font-family:sans-serif;font-size:14px;line-height:1.6;">
          ❌ Failed (permission: ${perm})<br>
          <span style="color:#64748b;font-size:12px">Check browser notification settings</span><br>
          <button onclick="this.parentElement.parentElement.remove()" style="margin-top:12px;padding:8px 16px;background:#1e3a5f;color:#94a3b8;border:none;border-radius:8px;cursor:pointer">Close</button>
        </div>`;
      }
    }
  } catch(err) {
    alert('Push error: ' + err.message);
    el?.remove();
  }
};

window.dismissPushBanner = () => {
  document.getElementById('pushSheet')?.remove();
  document.getElementById('pushBanner')?.remove();
};

// ─── initTranslator — called after translator page DOM is rendered ────────────
export function initTranslator() {
  // Set default languages from user preference
  if (session.user?.language) {
    state.sourceLang = LANGUAGES.find(l => l.code === session.user.language) || LANGUAGES[0];
    state.targetLang = LANGUAGES.find(l => l.code !== state.sourceLang.code) || LANGUAGES[1];
  }

  renderLangSelectors();
  document.addEventListener('touchend', unlockAudio, { once: true });
}

// ─── Language Controls ────────────────────────────────────────────────────────
window.onSwapLanguage = () => {
  swapLanguages();
  destroyRecognition();
  renderLangSelectors();
  clearCards();
  state.lastTranslation = '';
  setUIIdle();
};

window.onSourceLangChange = (code) => {
  state.sourceLang = LANGUAGES.find(l => l.code === code);
  state.targetLang = LANGUAGES.find(l => l.code !== code) || LANGUAGES[1];
  destroyRecognition();
  renderLangSelectors();
  clearCards();
  state.lastTranslation = '';
  setUIIdle();
};

window.onTargetLangChange = (code) => {
  state.targetLang = LANGUAGES.find(l => l.code === code);
  clearCards();
  state.lastTranslation = '';
};

// ─── Mic Button ───────────────────────────────────────────────────────────────
window.handleMic = () => {
  if (isIOS && state.phase === 'done' && state.lastTranslation) {
    speak(state.lastTranslation, state.targetLang.speechCode, () => {
      state.phase = 'idle';
      setUIIdle();
    });
    return;
  }

  if (state.phase === 'processing') return;

  if (state.phase === 'recording') {
    stopListening();
  } else {
    hideError();
    if (!buildRecognition(onTranscriptReady)) {
      showError('Speech recognition not supported. Use Safari on iPhone or Chrome on Android.');
      return;
    }
    startListening();
  }
};

// ─── Translation Flow ─────────────────────────────────────────────────────────
async function onTranscriptReady(text) {
  state.phase = 'processing';
  setUIProcessing();

  try {
    const translation = await fetchTranslation(
      text,
      state.sourceLang.code,
      state.targetLang.code
    );

    state.lastTranslation = translation;
    setOutputText(translation);

    if (isIOS) {
      state.phase = 'done';
      setUIReadyToSpeak();
    } else {
      await speakAsync(translation, state.targetLang.speechCode);
      state.phase = 'idle';
      setUISuccess();
    }

  } catch (err) {
    state.phase = 'idle';
    setUIIdle();
    showError('Translation failed: ' + err.message);
  }
}

// ─── Replay & Copy ────────────────────────────────────────────────────────────
window.speakOutput = () => {
  if (!state.lastTranslation) return;
  speak(state.lastTranslation, state.targetLang.speechCode, null);
  showToast('▶ Playing...');
};

window.copyOutput = () => {
  if (!state.lastTranslation) return;
  navigator.clipboard.writeText(state.lastTranslation)
    .then(() => showToast('⎘ Copied!'))
    .catch(() => showToast('Could not copy'));
};

window.clearAll = () => {
  clearCards();
  state.lastTranslation = '';
  state.phase = 'idle';
  hideError();
  setUIIdle();
};
