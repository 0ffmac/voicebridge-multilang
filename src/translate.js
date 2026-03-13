import { WORKER_URL } from './config.js';

// ─── Translation API ──────────────────────────────────────────────────────────
export async function fetchTranslation(text, sourceLangCode, targetLangCode) {
  const res = await fetch(`${WORKER_URL}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, sourceLang: sourceLangCode, targetLang: targetLangCode }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  if (data.error) throw new Error(data.error);

  return data.translation;
}
