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

// ─── Boot ─────────────────────────────────────────────────────────────────────
preloadVoices();
window.router = router;
router.init();

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
