// worker/api/messages.js
import { requireAuth } from './auth.js';
import { nanoid } from 'nanoid';

// GET /api/messages/:friendId — get conversation with a friend
export async function getConversation(request, env, friendId) {
  const session = await requireAuth(request, env);
  if (!session) return err('Unauthorized', 401);

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const before = url.searchParams.get('before'); // for pagination

  const results = await env.DB.prepare(`
    SELECT * FROM messages
    WHERE (sender_id = ? AND receiver_id = ?)
    OR (sender_id = ? AND receiver_id = ?)
    ${before ? 'AND created_at < ?' : ''}
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(
    session.user_id, friendId,
    friendId, session.user_id,
    ...(before ? [before] : []),
    limit
  ).all();

  // Mark messages as read
  await env.DB.prepare(
    `UPDATE messages SET is_read = 1
     WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`
  ).bind(friendId, session.user_id).run();

  return ok({ messages: results.results.reverse() });
}

// GET /api/messages/unread — unread count per friend
export async function getUnreadCounts(request, env) {
  const session = await requireAuth(request, env);
  if (!session) return err('Unauthorized', 401);

  const results = await env.DB.prepare(`
    SELECT sender_id, COUNT(*) as count
    FROM messages
    WHERE receiver_id = ? AND is_read = 0
    GROUP BY sender_id
  `).bind(session.user_id).all();

  return ok({ unread: results.results });
}

// POST /api/messages/send — send a translated voice message
export async function sendMessage(request, env) {
  const session = await requireAuth(request, env);
  if (!session) return err('Unauthorized', 401);

  const { receiver_id, original_text, original_lang, target_lang } = await request.json();

  if (!receiver_id || !original_text || !original_lang || !target_lang)
    return err('Missing required fields', 400);

  // Verify they are friends
  const friendship = await env.DB.prepare(`
    SELECT id FROM friends
    WHERE ((requester_id = ? AND receiver_id = ?) OR (requester_id = ? AND receiver_id = ?))
    AND status = 'accepted'
  `).bind(session.user_id, receiver_id, receiver_id, session.user_id).first();

  if (!friendship) return err('Not friends with this user', 403);

  // Translate via Workers AI
  let translated_text = original_text;
  if (original_lang !== target_lang) {
    const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Translate from ${original_lang} to ${target_lang}. Output only the translation.`,
        },
        {
          role: 'user',
          content: `Translate this from ${original_lang} to ${target_lang}:\n\n${original_text}`,
        },
      ],
      max_tokens: 512,
    });
    translated_text = (aiResponse.response || '').trim();
  }

  // Save to D1
  const id = nanoid();
  await env.DB.prepare(
    `INSERT INTO messages (id, sender_id, receiver_id, original_text, original_lang, translated_text, translated_lang, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, session.user_id, receiver_id, original_text, original_lang, translated_text, target_lang, Date.now()).run();

  return ok({
    id,
    original_text,
    translated_text,
    translated_lang: target_lang,
    created_at: Date.now(),
  });
}

function ok(data) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function err(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
