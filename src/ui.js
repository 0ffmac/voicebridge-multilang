import { LANGUAGES } from './config.js';
import { state } from './state.js';

// ─── Language Bar ─────────────────────────────────────────────────────────────
export function renderLangBar() {
	// const src = document.getElementById('srcLang');
	// const tgt = document.getElementById('tgtLang');
	// src.textContent = `${state.sourceLang.flag} ${state.sourceLang.label.toUpperCase()}`;
	// src.className = 'lang-tag active-src';
	// tgt.textContent = `${state.targetLang.flag} ${state.targetLang.label.toUpperCase()}`;
	// tgt.className = 'lang-tag active-tgt';
}

export function renderLangSelectors() {
	const srcSel = document.getElementById('srcSelect');
	const tgtSel = document.getElementById('tgtSelect');
	if (!srcSel || !tgtSel) return;

	[srcSel, tgtSel].forEach((sel, i) => {
		const current = i === 0 ? state.sourceLang : state.targetLang;
		sel.innerHTML = LANGUAGES.map(
			(l) => `<option value="${l.code}" ${l.code === current.code ? 'selected' : ''}>${l.flag} ${l.label}</option>`,
		).join('');
	});
}

// ─── Mic Button States ────────────────────────────────────────────────────────
export function setUIIdle() {
	_setMic('mic-btn', '🎙️', 'Tap to speak', 'mic-status');
	_setWaveform(false);
	_setRings(false);
	_setCardActive(false);
}

export function setUIRecording() {
	_setMic('mic-btn recording', '⏹', 'Listening... tap to stop', 'mic-status recording-status');
	_setWaveform(true);
	_setRings(true);
	_setCardActive(true);
}

export function setUIProcessing() {
	_setMic('mic-btn processing', '⟳', 'Translating...', 'mic-status processing-status');
	_setWaveform(false);
	_setRings(false);
}

export function setUIReadyToSpeak() {
	_setMic('mic-btn', '🔊', '↑ Tap to hear translation', 'mic-status success-status');
	_setCardActive(false);
}

export function setUISuccess() {
	_setMic('mic-btn', '🎙️', '✓ Done — tap to translate again', 'mic-status success-status');
	_setCardActive(false);
}

// ─── Text Cards ───────────────────────────────────────────────────────────────
export function setInputText(text, isInterim = false) {
	const el = document.getElementById('inputText');
	el.textContent = text;
	el.className = `card-text${isInterim ? ' placeholder' : ''}`;
}

export function setOutputText(text) {
	const el = document.getElementById('outputText');
	el.textContent = text;
	el.className = 'card-text';
}

export function clearCards() {
	setInputText('Tap the mic and speak...', true);
	setOutputText('Translation will appear here...');
	document.getElementById('outputText').className = 'card-text placeholder';
}

// ─── Error & Toast ────────────────────────────────────────────────────────────
export function showError(msg) {
	const el = document.getElementById('errorMsg');
	el.textContent = msg;
	el.classList.add('show');
}

export function hideError() {
	document.getElementById('errorMsg').classList.remove('show');
}

export function showToast(msg) {
	const t = document.getElementById('toast');
	t.textContent = msg;
	t.classList.add('show');
	setTimeout(() => t.classList.remove('show'), 2000);
}

// ─── Private helpers ──────────────────────────────────────────────────────────
function _setMic(btnClass, icon, statusText, statusClass) {
	document.getElementById('micBtn').className = btnClass;
	document.getElementById('micIcon').textContent = icon;
	document.getElementById('micStatus').textContent = statusText;
	document.getElementById('micStatus').className = statusClass;
}

function _setWaveform(visible) {
	document.getElementById('waveform').classList.toggle('visible', visible);
}

function _setRings(active) {
	['ring1', 'ring2', 'ring3'].forEach((id) => document.getElementById(id).classList.toggle('pulse', active));
}

function _setCardActive(active) {
	document.getElementById('inputCard').classList.toggle('active', active);
}
