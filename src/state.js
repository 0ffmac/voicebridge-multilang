import { LANGUAGES } from './config.js';

// ─── Central State ────────────────────────────────────────────────────────────
export const state = {
  // 'idle' | 'recording' | 'processing' | 'done'
  phase: 'idle',

  sourceLang: LANGUAGES[0],   // full language object
  targetLang: LANGUAGES[1],   // full language object

  lastTranscript: '',
  lastTranslation: '',
  pendingTranslate: false,

  recognition: null,
  recognitionLang: null,
  silenceTimer: null,

  synthesis: window.speechSynthesis,
};

export function swapLanguages() {
  [state.sourceLang, state.targetLang] = [state.targetLang, state.sourceLang];
}

export function setSourceLang(lang) {
  state.sourceLang = lang;
  state.targetLang = LANGUAGES.find(l => l.code !== lang.code) || LANGUAGES[1];
}
