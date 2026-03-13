import { state } from './state.js';
import { SILENCE_TIMEOUT_MS } from './config.js';
import { setUIRecording, setUIIdle, setInputText, showError } from './ui.js';

// ─── Platform Detection ───────────────────────────────────────────────────────
export const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

// ─── Public API ───────────────────────────────────────────────────────────────
export function buildRecognition(onTranscriptReady) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return false;

  const lang = state.sourceLang.speechCode;
  if (state.recognition && state.recognitionLang === lang) return true;

  destroyRecognition();

  const rec = new SR();
  rec.lang = lang;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  if (isIOS) {
    _setupIOS(rec, onTranscriptReady);
  } else {
    _setupAndroid(rec, onTranscriptReady);
  }

  state.recognition = rec;
  state.recognitionLang = lang;
  return true;
}

export function startListening() {
  state.lastTranscript = '';
  state.pendingTranslate = false;
  try { state.recognition.start(); } catch (e) { /* already started */ }
}

export function stopListening() {
  clearTimeout(state.silenceTimer);
  state.pendingTranslate = !!state.lastTranscript;
  try { state.recognition?.stop(); } catch (e) {}
}

export function destroyRecognition() {
  if (!state.recognition) return;
  state.recognition.onstart = null;
  state.recognition.onresult = null;
  state.recognition.onerror = null;
  state.recognition.onend = null;
  try { state.recognition.abort(); } catch (e) {}
  state.recognition = null;
  state.recognitionLang = null;
}

// ─── iOS Setup ────────────────────────────────────────────────────────────────
function _setupIOS(rec, onTranscriptReady) {
  rec.continuous = true;

  rec.onstart = () => {
    state.phase = 'recording';
    state.lastTranscript = '';
    state.pendingTranslate = false;
    setUIRecording();
    _resetSilenceTimer(() => {
      state.pendingTranslate = !!state.lastTranscript;
      stopListening();
    });
  };

  rec.onresult = (event) => {
    let finalText = '', interimText = '';
    for (let i = 0; i < event.results.length; i++) {
      if (event.results[i].isFinal) finalText += event.results[i][0].transcript + ' ';
      else interimText += event.results[i][0].transcript;
    }
    state.lastTranscript = (finalText || interimText).trim();
    setInputText(state.lastTranscript, !finalText);
    _resetSilenceTimer(() => {
      state.pendingTranslate = !!state.lastTranscript;
      stopListening();
    });
  };

  rec.onerror = _handleError;

  rec.onend = () => {
    clearTimeout(state.silenceTimer);
    state.phase = 'idle';
    setUIIdle();
    if (state.pendingTranslate && state.lastTranscript) {
      state.pendingTranslate = false;
      onTranscriptReady(state.lastTranscript);
    }
  };
}

// ─── Android Setup ────────────────────────────────────────────────────────────
function _setupAndroid(rec, onTranscriptReady) {
  rec.continuous = false;

  rec.onstart = () => {
    state.phase = 'recording';
    state.lastTranscript = '';
    state.pendingTranslate = false;
    setUIRecording();
  };

  rec.onresult = (event) => {
    const result = event.results[event.results.length - 1];
    const text = result[0].transcript.trim();
    state.lastTranscript = text;
    setInputText(text, !result.isFinal);
    if (result.isFinal) {
      state.pendingTranslate = true;
      stopListening();
    }
  };

  rec.onerror = _handleError;

  rec.onend = () => {
    state.phase = 'idle';
    setUIIdle();
    if (state.pendingTranslate && state.lastTranscript) {
      state.pendingTranslate = false;
      onTranscriptReady(state.lastTranscript);
    }
  };
}

// ─── Shared Helpers ───────────────────────────────────────────────────────────
function _resetSilenceTimer(onSilence) {
  clearTimeout(state.silenceTimer);
  state.silenceTimer = setTimeout(onSilence, SILENCE_TIMEOUT_MS);
}

function _handleError(e) {
  clearTimeout(state.silenceTimer);
  state.phase = 'idle';
  setUIIdle();
  if (e.error === 'not-allowed') {
    destroyRecognition();
    showError('Microphone permission denied. Allow mic in Settings.');
  } else if (e.error !== 'aborted' && e.error !== 'no-speech') {
    showError('Mic error: ' + e.error);
  }
}
