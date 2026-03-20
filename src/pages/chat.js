// src/pages/chat.js
import { API } from '../api/client.js';
import { session } from '../session.js';
import { LANGUAGES } from '../config.js';
import { isIOS, buildRecognition, startListening, stopListening, destroyRecognition } from '../recognition.js';
import { speak, unlockAudio } from '../tts.js';
import { state } from '../state.js';

let chatState = {
  friendId: null,
  friendName: null,
  friendLang: null,
  phase: 'idle', // 'idle' | 'recording' | 'processing' | 'done'
  lastTranscript: '',
  lastTranslation: '',
};

export async function renderChatPage(params) {
  chatState.friendId = params.friendId;
  chatState.friendName = params.friendName;
  chatState.friendLang = params.friendLang;

  // Set state source lang from session user language
  state.sourceLang = LANGUAGES.find(l => l.code === session.user.language) || LANGUAGES[0];
  state.targetLang = LANGUAGES.find(l => l.code === chatState.friendLang) || LANGUAGES[1];

  document.getElementById('app').innerHTML = `
    <div class="app">
      <header>
        <button class="back-btn" onclick="window.router.go('contacts')">‹</button>
        <div class="chat-header-info">
          <div class="chat-name">${chatState.friendName}</div>
          <div class="chat-langs">${getLangFlag(session.user.language)} → ${getLangFlag(chatState.friendLang)}</div>
        </div>
        <button class="icon-btn" onclick="window.router.go('contacts')">👥</button>
      </header>

      <!-- Messages -->
      <div class="messages-list" id="messagesList">
        <div class="loading">Loading messages...</div>
      </div>

      <!-- Voice input bar -->
      <div class="chat-input-bar">
        <div class="chat-status" id="chatStatus">Tap mic to send a voice message</div>
        <div class="chat-transcript" id="chatTranscript"></div>
        <div class="chat-controls">
          <button class="chat-mic-btn" id="chatMicBtn" onclick="handleChatMic()">
            <span id="chatMicIcon">🎙️</span>
          </button>
        </div>
      </div>
    </div>
  `;

  document.addEventListener('touchend', unlockAudio, { once: true });
  await loadMessages();
}

async function loadMessages() {
  try {
    const { messages } = await API.get(`/api/messages/${chatState.friendId}`);
    renderMessages(messages);
  } catch(e) {
    document.getElementById('messagesList').innerHTML = '<div class="empty-state">Failed to load messages.</div>';
  }
}

function renderMessages(messages) {
  const el = document.getElementById('messagesList');
  if (!messages.length) {
    el.innerHTML = '<div class="empty-state">No messages yet.<br>Tap the mic to say something!</div>';
    return;
  }

  el.innerHTML = messages.map(m => {
    const isMine = m.sender_id === session.user.id;
    const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="message ${isMine ? 'message-mine' : 'message-theirs'}">
        <div class="message-bubble">
          <div class="message-original">${isMine ? m.original_text : m.translated_text}</div>
          <div class="message-translation">${isMine ? m.translated_text : m.original_text}</div>
          <button class="message-play" onclick="playMessage('${encodeURIComponent(isMine ? m.translated_text : m.original_text)}', '${isMine ? chatState.friendLang : session.user.language}')">▶</button>
        </div>
        <div class="message-time">${time}</div>
      </div>
    `;
  }).join('');

  // Scroll to bottom
  el.scrollTop = el.scrollHeight;
}

// ── Mic handling ──────────────────────────────────────────────────────────────
window.handleChatMic = () => {
  if (isIOS && chatState.phase === 'done' && chatState.lastTranslation) {
    speak(chatState.lastTranslation, chatState.friendLang, () => {
      chatState.phase = 'idle';
      setChatUIIdle();
    });
    return;
  }

  if (chatState.phase === 'processing') return;

  if (chatState.phase === 'recording') {
    stopListening();
  } else {
    startChatRecording();
  }
};

function startChatRecording() {
  destroyRecognition();
  if (!buildRecognition(onChatTranscriptReady)) return;
  chatState.phase = 'recording';
  chatState.lastTranscript = '';
  setChatUIRecording();
  startListening();
}

function onChatTranscriptReady(text) {
  chatState.lastTranscript = text;
  sendVoiceMessage(text);
}

async function sendVoiceMessage(text) {
  chatState.phase = 'processing';
  setChatUIProcessing();

  try {
    const msg = await API.post('/api/messages/send', {
      receiver_id: chatState.friendId,
      original_text: text,
      original_lang: session.user.language,
      target_lang: chatState.friendLang,
    });

    chatState.lastTranslation = msg.translated_text;

    // Reload messages
    await loadMessages();

    if (isIOS) {
      chatState.phase = 'done';
      setChatUIReadyToSpeak();
    } else {
      await new Promise(resolve => speak(msg.translated_text, chatState.friendLang, resolve));
      chatState.phase = 'idle';
      setChatUIIdle();
    }

  } catch(err) {
    chatState.phase = 'idle';
    setChatUIIdle();
    document.getElementById('chatStatus').textContent = 'Error: ' + err.message;
  }
}

window.playMessage = (text, lang) => {
  speak(decodeURIComponent(text), lang, null);
};

// ── Chat UI states ────────────────────────────────────────────────────────────
function setChatUIIdle() {
  document.getElementById('chatMicBtn').className = 'chat-mic-btn';
  document.getElementById('chatMicIcon').textContent = '🎙️';
  document.getElementById('chatStatus').textContent = 'Tap mic to send a voice message';
  document.getElementById('chatTranscript').textContent = '';
}

function setChatUIRecording() {
  document.getElementById('chatMicBtn').className = 'chat-mic-btn recording';
  document.getElementById('chatMicIcon').textContent = '⏹';
  document.getElementById('chatStatus').textContent = 'Listening... tap to stop';
}

function setChatUIProcessing() {
  document.getElementById('chatMicBtn').className = 'chat-mic-btn processing';
  document.getElementById('chatMicIcon').textContent = '⟳';
  document.getElementById('chatStatus').textContent = 'Translating & sending...';
  document.getElementById('chatTranscript').textContent = chatState.lastTranscript;
}

function setChatUIReadyToSpeak() {
  document.getElementById('chatMicBtn').className = 'chat-mic-btn';
  document.getElementById('chatMicIcon').textContent = '🔊';
  document.getElementById('chatStatus').textContent = '↑ Tap to hear your translation';
}

function getLangFlag(code) {
  return LANGUAGES.find(l => l.code === code)?.flag || '🌐';
}
