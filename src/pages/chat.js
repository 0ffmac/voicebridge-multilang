// src/pages/chat.js
import { API } from '../api/client.js';
import { session } from '../session.js';
import { LANGUAGES, SILENCE_TIMEOUT_MS } from '../config.js';
import { isIOS } from '../recognition.js';
import { speak, unlockAudio } from '../tts.js';
import { avatarImg } from '../avatar.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let chatState = {
  friendId: null,
  friendName: null,
  friendLang: null,
  friendUsername: null,
  phase: 'idle',
  lastTranscript: '',
  lastTranslation: '',
  lastTranslationSpeechCode: null,
  recognition: null,
  silenceTimer: null,
  pollTimer: null,
  messageCount: 0,
};

const POLL_INTERVAL_MS = 8000;

export async function renderChatPage(params) {
  chatState.friendId = params.friendId;
  chatState.friendName = params.friendName;
  chatState.friendLang = params.friendLang;
  chatState.friendUsername = params.friendUsername || params.friendName;
  chatState.phase = 'idle';
  chatState.lastTranscript = '';
  chatState.lastTranslation = '';
  chatState.lastTranslationSpeechCode = null;
  chatState.messageCount = 0;
  stopPolling();

  document.getElementById('app').innerHTML = `
    <div class="app">
      <header>
        <button class="back-btn" onclick="leaveChatPage()">‹</button>
        <div class="chat-header-info">
          ${avatarImg(chatState.friendUsername, 32, 'chat-header-avatar')}
          <div>
            <div class="chat-name">${chatState.friendName}</div>
            <div class="chat-langs">
              ${getLangFlag(session.user.language)} → ${getLangFlag(chatState.friendLang)}
            </div>
          </div>
        </div>
        <button class="icon-btn danger-icon" onclick="confirmDeleteConversation()" title="Delete conversation">🗑</button>
      </header>

      <div class="messages-list" id="messagesList">
        <div class="loading">Loading messages...</div>
      </div>

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

    <!-- Delete conversation modal -->
    <div class="modal-overlay" id="deleteConvModal" style="display:none">
      <div class="modal-card">
        <div class="modal-icon">🗑</div>
        <div class="modal-title">Delete Conversation?</div>
        <div class="modal-body">
          This will delete all messages with <strong>${chatState.friendName}</strong> for you.
          They will still see the messages on their end.
        </div>
        <button class="danger-btn" onclick="handleDeleteConversation()">Delete for me</button>
        <button class="ghost-btn" onclick="closeModal()">Cancel</button>
      </div>
    </div>

    <!-- Delete single message modal -->
    <div class="modal-overlay" id="deleteMsgModal" style="display:none">
      <div class="modal-card">
        <div class="modal-icon">🗑</div>
        <div class="modal-title">Delete Message?</div>
        <div class="modal-body">This message will be removed for you.</div>
        <button class="danger-btn" id="confirmDeleteMsgBtn">Delete</button>
        <button class="ghost-btn" onclick="closeModal()">Cancel</button>
      </div>
    </div>
  `;

  document.addEventListener('touchend', unlockAudio, { once: true });
  await loadMessages();
  startPolling();
}

window.leaveChatPage = () => {
  stopPolling();
  stopChatListening(false);
  window.router.go('contacts');
};

window.closeModal = () => {
  document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
};

// ── Delete conversation ────────────────────────────────────────────────────────
window.confirmDeleteConversation = () => {
  document.getElementById('deleteConvModal').style.display = 'flex';
};

window.handleDeleteConversation = async () => {
  try {
    await API.delete(`/api/messages/conversation/${chatState.friendId}`);
    closeModal();
    chatState.messageCount = 0;
    await loadMessages();
  } catch (err) {
    closeModal();
    setChatStatus('Error: ' + err.message);
  }
};

// ── Delete single message ─────────────────────────────────────────────────────
window.confirmDeleteMessage = (messageId) => {
  const modal = document.getElementById('deleteMsgModal');
  modal.style.display = 'flex';
  document.getElementById('confirmDeleteMsgBtn').onclick = () => handleDeleteMessage(messageId);
};

async function handleDeleteMessage(messageId) {
  try {
    await API.delete(`/api/messages/${messageId}`);
    closeModal();
    const { messages } = await API.get(`/api/messages/${chatState.friendId}`);
    chatState.messageCount = messages.length;
    renderMessages(messages);
  } catch (err) {
    closeModal();
    setChatStatus('Error: ' + err.message);
  }
}

// ── Polling ───────────────────────────────────────────────────────────────────
function startPolling() {
  stopPolling();
  chatState.pollTimer = setInterval(pollMessages, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (chatState.pollTimer) { clearInterval(chatState.pollTimer); chatState.pollTimer = null; }
}

async function pollMessages() {
  if (chatState.phase === 'recording' || chatState.phase === 'processing') return;
  try {
    const { messages } = await API.get(`/api/messages/${chatState.friendId}`);
    const newCount = messages.length;
    if (newCount > chatState.messageCount) {
      const atBottom = isAtBottom();
      renderMessages(messages);
      if (atBottom) scrollToBottom();
      else showNewMessageBadge(newCount - chatState.messageCount);
      chatState.messageCount = newCount;
    }
  } catch(e) {}
}

function isAtBottom() {
  const el = document.getElementById('messagesList');
  return el ? el.scrollHeight - el.scrollTop - el.clientHeight < 60 : true;
}

function scrollToBottom() {
  const el = document.getElementById('messagesList');
  if (el) el.scrollTop = el.scrollHeight;
}

function showNewMessageBadge(count) {
  document.getElementById('newMsgBadge')?.remove();
  const badge = document.createElement('div');
  badge.id = 'newMsgBadge';
  badge.className = 'new-msg-badge';
  badge.textContent = `↓ ${count} new message${count > 1 ? 's' : ''}`;
  badge.onclick = () => { scrollToBottom(); badge.remove(); };
  document.querySelector('.chat-input-bar')?.prepend(badge);
}

// ── Load & render messages ────────────────────────────────────────────────────
async function loadMessages() {
  try {
    const { messages } = await API.get(`/api/messages/${chatState.friendId}`);
    chatState.messageCount = messages.length;
    renderMessages(messages);
    scrollToBottom();
  } catch(e) {
    document.getElementById('messagesList').innerHTML =
      '<div class="empty-state">Failed to load messages.</div>';
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
    const mainText = escapeHtml(isMine ? m.original_text : m.translated_text);
    const subText  = escapeHtml(isMine ? m.translated_text : m.original_text);
    const playText = m.translated_text;
    const playLang = m.translated_lang;
    return `
      <div class="message ${isMine ? 'message-mine' : 'message-theirs'}"
           oncontextmenu="confirmDeleteMessage('${m.id}'); return false;">
        <div class="message-bubble">
          <div class="message-original">${mainText}</div>
          <div class="message-translation">${subText}</div>
          <div class="message-footer">
          <div class="message-actions">
            <button class="message-play"
              onclick="playMessage('${encodeURIComponent(playText)}','${playLang}')">▶ Play</button>
            <button class="message-delete"
              onclick="confirmDeleteMessage('${m.id}')">🗑</button>
          </div>
          <div class="message-time">${time}</div>
        </div>
        </div>
      </div>
    `;
  }).join('');
}

window.playMessage = (text, lang) => {
  const speechCode = LANGUAGES.find(l => l.code === lang)?.speechCode || lang;
  speak(decodeURIComponent(text), speechCode, null);
};

// ── Mic handling ──────────────────────────────────────────────────────────────
window.handleChatMic = () => {
  if (isIOS && chatState.phase === 'done' && chatState.lastTranslation) {
    const speechCode = chatState.lastTranslationSpeechCode || chatState.friendLang;
    speak(chatState.lastTranslation, speechCode, () => {
      chatState.phase = 'idle';
      setChatUIIdle();
    });
    return;
  }
  if (chatState.phase === 'processing') return;
  if (chatState.phase === 'recording') {
    chatState.phase = 'stopping';
    stopChatListening(true);
  } else {
    startChatListening();
  }
};

function startChatListening() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { setChatStatus('Speech recognition not supported.'); return; }

  stopChatListening(false);

  const lang = LANGUAGES.find(l => l.code === session.user.language)?.speechCode || 'en-US';
  const rec = new SR();
  rec.lang = lang;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.continuous = isIOS ? true : false;

  rec.onstart = () => {
    chatState.phase = 'recording';
    chatState.lastTranscript = '';
    setChatUIRecording();
    if (isIOS) resetChatSilenceTimer();
  };

  rec.onresult = (event) => {
    if (isIOS) {
      let finalText = '', interimText = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript + ' ';
        else interimText += event.results[i][0].transcript;
      }
      chatState.lastTranscript = (finalText || interimText).trim();
      document.getElementById('chatTranscript').textContent = chatState.lastTranscript;
      resetChatSilenceTimer();
    } else {
      const result = event.results[event.results.length - 1];
      chatState.lastTranscript = result[0].transcript.trim();
      document.getElementById('chatTranscript').textContent = chatState.lastTranscript;
      if (result.isFinal) { clearTimeout(chatState.silenceTimer); stopChatListening(true); }
    }
  };

  rec.onerror = (e) => {
    clearTimeout(chatState.silenceTimer);
    chatState.phase = 'idle';
    setChatUIIdle();
    if (e.error === 'not-allowed') setChatStatus('Microphone permission denied.');
    else if (e.error !== 'aborted' && e.error !== 'no-speech') setChatStatus('Mic error: ' + e.error);
  };

  rec.onend = () => {
    clearTimeout(chatState.silenceTimer);
    if (chatState.phase === 'recording' || chatState.phase === 'stopping') {
      const text = chatState.lastTranscript;
      chatState.phase = 'idle';
      if (text) sendVoiceMessage(text);
      else setChatUIIdle();
    }
  };

  chatState.recognition = rec;
  rec.start();
}

function stopChatListening(shouldTranslate = false) {
  clearTimeout(chatState.silenceTimer);
  if (!shouldTranslate) chatState.phase = 'idle';
  if (chatState.recognition) {
    try { chatState.recognition.stop(); } catch(e) {}
    chatState.recognition = null;
  }
}

function resetChatSilenceTimer() {
  clearTimeout(chatState.silenceTimer);
  chatState.silenceTimer = setTimeout(() => {
    if (chatState.phase === 'recording' && chatState.lastTranscript) {
      chatState.phase = 'stopping';
      stopChatListening(true);
    } else if (chatState.phase === 'recording') {
      stopChatListening(false);
      setChatUIIdle();
    }
  }, SILENCE_TIMEOUT_MS);
}

// ── Send message ──────────────────────────────────────────────────────────────
async function sendVoiceMessage(text) {
  chatState.phase = 'processing';
  setChatUIProcessing(text);

  try {
    const msg = await API.post('/api/messages/send', {
      receiver_id: chatState.friendId,
      original_text: text,
      original_lang: session.user.language,
    });

    chatState.lastTranslation = msg.translated_text;
    const translatedSpeechCode = LANGUAGES.find(l => l.code === msg.translated_lang)?.speechCode || msg.translated_lang;
    chatState.lastTranslationSpeechCode = translatedSpeechCode;

    const { messages } = await API.get(`/api/messages/${chatState.friendId}`);
    chatState.messageCount = messages.length;
    renderMessages(messages);
    scrollToBottom();

    if (isIOS) {
      chatState.phase = 'done';
      setChatUIReadyToSpeak();
    } else {
      await new Promise(resolve => speak(msg.translated_text, translatedSpeechCode, resolve));
      chatState.phase = 'idle';
      setChatUIIdle();
    }
  } catch(err) {
    chatState.phase = 'idle';
    setChatUIIdle();
    setChatStatus('Error: ' + err.message);
  }
}

// ── UI helpers ────────────────────────────────────────────────────────────────
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
function setChatUIProcessing(text) {
  document.getElementById('chatMicBtn').className = 'chat-mic-btn processing';
  document.getElementById('chatMicIcon').textContent = '⟳';
  document.getElementById('chatStatus').textContent = 'Translating & sending...';
  document.getElementById('chatTranscript').textContent = text;
}
function setChatUIReadyToSpeak() {
  document.getElementById('chatMicBtn').className = 'chat-mic-btn';
  document.getElementById('chatMicIcon').textContent = '🔊';
  document.getElementById('chatStatus').textContent = '↑ Tap to hear your translation';
}
function setChatStatus(msg) {
  const el = document.getElementById('chatStatus');
  if (el) el.textContent = msg;
}
function getLangFlag(code) {
  return LANGUAGES.find(l => l.code === code)?.flag || '🌐';
}
