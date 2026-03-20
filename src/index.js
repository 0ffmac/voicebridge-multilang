// src/index.js - Main Worker Router
import { sendMagicLink, verifyMagicLink, logout } from '../worker/api/auth.js';
import { getMe, updateMe, searchUsers } from '../worker/api/users.js';
import { listFriends, pendingRequests, sendInvite, acceptInvite, declineInvite } from '../worker/api/friends.js';
import { getConversation, getUnreadCounts, sendMessage } from '../worker/api/messages.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request, env, ctx) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // ── Auth ────────────────────────────────────────────────────────────────
      if (path === '/api/auth/send-link' && method === 'POST')
        return await sendMagicLink(request, env);

      if (path === '/api/auth/verify' && method === 'GET')
        return await verifyMagicLink(request, env);

      if (path === '/api/auth/logout' && method === 'POST')
        return await logout(request, env);

      // ── Translation (existing feature, kept as is) ───────────────────────
      if (path === '/translate' && method === 'POST')
        return await handleTranslate(request, env);

      // ── Users ───────────────────────────────────────────────────────────
      if (path === '/api/users/me' && method === 'GET')
        return await getMe(request, env);

      if (path === '/api/users/me' && method === 'PUT')
        return await updateMe(request, env);

      if (path === '/api/users/search' && method === 'GET')
        return await searchUsers(request, env);

      // ── Friends ─────────────────────────────────────────────────────────
      if (path === '/api/friends' && method === 'GET')
        return await listFriends(request, env);

      if (path === '/api/friends/pending' && method === 'GET')
        return await pendingRequests(request, env);

      if (path === '/api/friends/invite' && method === 'POST')
        return await sendInvite(request, env);

      // /api/friends/:id/accept
      const acceptMatch = path.match(/^\/api\/friends\/([^/]+)\/accept$/);
      if (acceptMatch && method === 'POST')
        return await acceptInvite(request, env, acceptMatch[1]);

      // /api/friends/:id/decline
      const declineMatch = path.match(/^\/api\/friends\/([^/]+)\/decline$/);
      if (declineMatch && method === 'POST')
        return await declineInvite(request, env, declineMatch[1]);

      // ── Messages ─────────────────────────────────────────────────────────
      if (path === '/api/messages/send' && method === 'POST')
        return await sendMessage(request, env);

      if (path === '/api/messages/unread' && method === 'GET')
        return await getUnreadCounts(request, env);

      // /api/messages/:friendId
      const msgMatch = path.match(/^\/api\/messages\/([^/]+)$/);
      if (msgMatch && method === 'GET')
        return await getConversation(request, env, msgMatch[1]);

      // 404
      return jsonResponse({ error: 'Not found' }, 404);

    } catch (e) {
      console.error(e);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  },
};

// ── Existing translation handler (unchanged) ──────────────────────────────────
async function handleTranslate(request, env) {
  const { text, sourceLang, targetLang } = await request.json();
  if (!text?.trim()) return jsonResponse({ error: 'No text provided' }, 400);

  const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      {
        role: 'system',
        content: `You are a professional translator. Translate from ${sourceLang} to ${targetLang}. Output only the translation.`,
      },
      {
        role: 'user',
        content: `Translate this from ${sourceLang} to ${targetLang}:\n\n${text}`,
      },
    ],
    max_tokens: 512,
  });

  return jsonResponse({ translation: (response.response || '').trim() });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
