// ─── App Configuration ────────────────────────────────────────────────────────
// To add a new language: add an entry to LANGUAGES below.
// The app will automatically support any pair from that list.




// export const WORKER_URL = 'https://voicebridge-api.comblog.workers.dev';
// export const WORKER_URL = 'https://voicebridge-multi.comblog.workers.dev';
export const WORKER_URL = 'http://localhost:8787';

export const LANGUAGES = [
	{ code: 'en', label: 'English', flag: '🇺🇸', speechCode: 'en-US' },
	{ code: 'id', label: 'Indonesian', flag: '🇮🇩', speechCode: 'id-ID' },
	{ code: 'es', label: 'Spanish', flag: '🇪🇸', speechCode: 'es-ES' },
	{ code: 'fr', label: 'French', flag: '🇫🇷', speechCode: 'fr-FR' },
	{ code: 'ja', label: 'Japanese', flag: '🇯🇵', speechCode: 'ja-JP' },
	{ code: 'ar', label: 'Arabic', flag: '🇸🇦', speechCode: 'ar-SA' },
	{ code: 'ms', label: 'Malay', flag: '🇲🇾', speechCode: 'ms-MY' },
	{ code: 'th', label: 'Thai', flag: '🇹🇭', speechCode: 'th-TH' },
	{ code: 'pt-BR', label: 'Portuguese (BR)', flag: '🇧🇷', speechCode: 'pt-BR' },
	{ code: 'hi', label: 'Hindi', flag: '🇮🇳', speechCode: 'hi-IN' },
	{ code: 'ar-AE', label: 'Arabic (Dubai)', flag: '🇦🇪', speechCode: 'ar-AE' },
];

export const SILENCE_TIMEOUT_MS = 3000; // iOS silence detection threshold
