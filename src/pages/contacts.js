// src/pages/contacts.js
import { API } from '../api/client.js';
import { session } from '../session.js';
import { LANGUAGES } from '../config.js';

export async function renderContactsPage() {
  document.getElementById('app').innerHTML = `
    <div class="app">
      <header>
        <div class="logo">Voice<span>Bridge</span></div>
        <div class="header-actions">
          <button class="icon-btn" onclick="window.router.go('translator')" title="Translator">🌐</button>
          <button class="icon-btn" onclick="window.router.go('profile')" title="Profile">👤</button>
        </div>
      </header>

      <!-- Search -->
      <div class="search-bar">
        <input type="text" id="searchInput" placeholder="Search users by @username..."
          oninput="handleSearch(this.value)" autocomplete="off" />
      </div>

      <div id="searchResults" style="display:none">
        <div class="section-label">// SEARCH RESULTS</div>
        <div id="searchList"></div>
      </div>

      <!-- Pending requests -->
      <div id="pendingSection" style="display:none">
        <div class="section-label">// FRIEND REQUESTS</div>
        <div id="pendingList"></div>
      </div>

      <!-- Friends list -->
      <div class="section-label">// YOUR CONTACTS</div>
      <div id="friendsList">
        <div class="loading">Loading...</div>
      </div>
    </div>
  `;

  await loadFriends();
  await loadPending();
}

async function loadFriends() {
  try {
    const { friends } = await API.get('/api/friends');
    const { unread } = await API.get('/api/messages/unread');
    const unreadMap = {};
    unread.forEach(u => unreadMap[u.sender_id] = u.count);

    const el = document.getElementById('friendsList');
    if (!friends.length) {
      el.innerHTML = `<div class="empty-state">No contacts yet.<br>Search for users above to add friends.</div>`;
      return;
    }

    el.innerHTML = friends.map(f => `
      <div class="contact-card" onclick="window.router.go('chat', { friendId: '${f.user_id}', friendName: '${f.display_name}', friendLang: '${f.language}' })">
        <div class="contact-avatar">${f.display_name[0].toUpperCase()}</div>
        <div class="contact-info">
          <div class="contact-name">${f.display_name}</div>
          <div class="contact-lang">${getLangFlag(f.language)} ${getLangLabel(f.language)}</div>
        </div>
        ${unreadMap[f.user_id] ? `<div class="unread-badge">${unreadMap[f.user_id]}</div>` : ''}
        <div class="contact-arrow">›</div>
      </div>
    `).join('');
  } catch (err) {
    document.getElementById('friendsList').innerHTML = `<div class="empty-state">Failed to load contacts.</div>`;
  }
}

async function loadPending() {
  try {
    const { requests } = await API.get('/api/friends/pending');
    const section = document.getElementById('pendingSection');
    if (!requests.length) return;

    section.style.display = 'block';
    document.getElementById('pendingList').innerHTML = requests.map(r => `
      <div class="contact-card">
        <div class="contact-avatar">${r.display_name[0].toUpperCase()}</div>
        <div class="contact-info">
          <div class="contact-name">${r.display_name}</div>
          <div class="contact-lang">@${r.username}</div>
        </div>
        <div class="request-actions">
          <button class="accept-btn" onclick="handleAccept('${r.id}')">✓</button>
          <button class="decline-btn" onclick="handleDecline('${r.id}')">✕</button>
        </div>
      </div>
    `).join('');
  } catch(e) {}
}

let searchTimer;
window.handleSearch = (q) => {
  clearTimeout(searchTimer);
  const resultsEl = document.getElementById('searchResults');
  if (!q || q.length < 2) { resultsEl.style.display = 'none'; return; }
  searchTimer = setTimeout(async () => {
    try {
      const { users } = await API.get(`/api/users/search?q=${encodeURIComponent(q)}`);
      resultsEl.style.display = 'block';
      document.getElementById('searchList').innerHTML = users.length
        ? users.map(u => `
            <div class="contact-card">
              <div class="contact-avatar">${u.display_name[0].toUpperCase()}</div>
              <div class="contact-info">
                <div class="contact-name">${u.display_name}</div>
                <div class="contact-lang">@${u.username}</div>
              </div>
              <button class="add-btn" onclick="handleAddFriend('${u.id}', this)">+ Add</button>
            </div>
          `).join('')
        : '<div class="empty-state">No users found.</div>';
    } catch(e) {}
  }, 400);
};

window.handleAddFriend = async (userId, btn) => {
  btn.textContent = 'Sending...';
  btn.disabled = true;
  try {
    await API.post('/api/friends/invite', { receiver_id: userId });
    btn.textContent = '✓ Sent';
  } catch (err) {
    btn.textContent = err.message === 'Request already sent' ? '✓ Sent' : 'Error';
  }
};

window.handleAccept = async (id) => {
  await API.post(`/api/friends/${id}/accept`, {});
  await renderContactsPage();
};

window.handleDecline = async (id) => {
  await API.post(`/api/friends/${id}/decline`, {});
  await renderContactsPage();
};

function getLangFlag(code) {
  return LANGUAGES.find(l => l.code === code)?.flag || '🌐';
}
function getLangLabel(code) {
  return LANGUAGES.find(l => l.code === code)?.label || code;
}
