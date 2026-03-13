import { state } from './state.js';

// ─── Text-to-Speech ───────────────────────────────────────────────────────────

// Unlock audio on iOS — must be called on first user tap
export function unlockAudio() {
  if (!state.synthesis) return;
  const u = new SpeechSynthesisUtterance('');
  u.volume = 0;
  state.synthesis.speak(u);
  state.synthesis.cancel();
}

// Speak text in given language, call onDone when finished
export function speak(text, lang, onDone) {
  if (!state.synthesis) { onDone?.(); return; }
  state.synthesis.cancel();

  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = lang;
  utt.rate = 0.95;
  utt.pitch = 1;
  utt.volume = 1;

  const voices = state.synthesis.getVoices();
  const match = voices.find(v => v.lang.startsWith(lang.split('-')[0]));
  if (match) utt.voice = match;

  utt.onend = () => onDone?.();
  utt.onerror = () => onDone?.();
  state.synthesis.speak(utt);
}

// Promise-based speak that waits for voices to load
export function speakAsync(text, lang) {
  return new Promise((resolve) => {
    const voices = state.synthesis?.getVoices() || [];
    if (voices.length > 0) {
      speak(text, lang, resolve);
    } else {
      state.synthesis.onvoiceschanged = () => {
        state.synthesis.onvoiceschanged = null;
        speak(text, lang, resolve);
      };
      setTimeout(() => speak(text, lang, resolve), 500);
    }
  });
}

// Pre-load voices (call once on startup)
export function preloadVoices() {
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.getVoices();
  }
}
