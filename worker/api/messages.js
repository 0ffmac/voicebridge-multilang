// worker/api/messages.js
import { requireAuth } from './auth.js';
import { nanoid } from 'nanoid';

// GET /api/messages/:friendId
export async function getConversation(request, env, friendId) {
  const session = await requireAuth(request, env);
  if (!session) return err('Unauthorized', 401);

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');

  const results = await env.DB.prepare(`
    SELECT * FROM messages
    WHERE (
      (sender_id = ? AND receiver_id = ? AND deleted_by_sender = 0)
      OR
      (sender_id = ? AND receiver_id = ? AND deleted_by_receiver = 0)
    )
    ORDER BY created_at ASC
    LIMIT ?
  `).bind(session.user_id, friendId, friendId, session.user_id, limit).all();

  await env.DB.prepare(
    `UPDATE messages SET is_read = 1
     WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`
  ).bind(friendId, session.user_id).run();

  return ok({ messages: results.results });
}

// GET /api/messages/unread
export async function getUnreadCounts(request, env) {
  const session = await requireAuth(request, env);
  if (!session) return err('Unauthorized', 401);

  const results = await env.DB.prepare(`
    SELECT sender_id, COUNT(*) as count
    FROM messages
    WHERE receiver_id = ? AND is_read = 0 AND deleted_by_receiver = 0
    GROUP BY sender_id
  `).bind(session.user_id).all();

  return ok({ unread: results.results });
}

// POST /api/messages/send
export async function sendMessage(request, env) {
  const session = await requireAuth(request, env);
  if (!session) return err('Unauthorized', 401);

  const { receiver_id, original_text, original_lang } = await request.json();
  if (!receiver_id || !original_text || !original_lang)
    return err('Missing required fields', 400);

  const friendship = await env.DB.prepare(`
    SELECT id FROM friends
    WHERE ((requester_id = ? AND receiver_id = ?) OR (requester_id = ? AND receiver_id = ?))
    AND status = 'accepted'
  `).bind(session.user_id, receiver_id, receiver_id, session.user_id).first();

  if (!friendship) return err('Not friends with this user', 403);

  const receiver = await env.DB.prepare(
    'SELECT language FROM users WHERE id = ?'
  ).bind(receiver_id).first();

  if (!receiver) return err('Receiver not found', 404);
  const target_lang = receiver.language;

  let translated_text = original_text;
  if (original_lang !== target_lang) {
    const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: `You are a professional translator. Translate from ${original_lang} to ${target_lang}. Output only the translation.` },
        { role: 'user', content: `Translate this from ${original_lang} to ${target_lang}:\n\n${original_text}` },
      ],
      max_tokens: 512,
    });
    translated_text = (aiResponse.response || '').trim();
  }

  const id = nanoid();
  await env.DB.prepare(
    `INSERT INTO messages (id, sender_id, receiver_id, original_text, original_lang, translated_text, translated_lang, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, session.user_id, receiver_id, original_text, original_lang, translated_text, target_lang, Date.now()).run();

  return ok({ id, original_text, translated_text, translated_lang: target_lang, created_at: Date.now() });
}

// DELETE /api/messages/:id — soft delete single message
export async function deleteMessage(request, env, messageId) {
  const session = await requireAuth(request, env);
  if (!session) return err('Unauthorized', 401);

  const msg = await env.DB.prepare('SELECT * FROM messages WHERE id = ?').bind(messageId).first();
  if (!msg) return err('Message not found', 404);
  if (msg.sender_id !== session.user_id && msg.receiver_id !== session.user_id)
    return err('Not authorized', 403);

  if (msg.sender_id === session.user_id) {
    await env.DB.prepare('UPDATE messages SET deleted_by_sender = 1 WHERE id = ?').bind(messageId).run();
  } else {
    await env.DB.prepare('UPDATE messages SET deleted_by_receiver = 1 WHERE id = ?').bind(messageId).run();
  }

  // Clean up if both sides deleted
  const updated = await env.DB.prepare(
    'SELECT deleted_by_sender, deleted_by_receiver FROM messages WHERE id = ?'
  ).bind(messageId).first();
  if (updated?.deleted_by_sender && updated?.deleted_by_receiver) {
    await env.DB.prepare('DELETE FROM messages WHERE id = ?').bind(messageId).run();
  }

  return ok({ message: 'Message deleted' });
}

// DELETE /api/messages/conversation/:friendId
export async function deleteConversation(request, env, friendId) {
  const session = await requireAuth(request, env);
  if (!session) return err('Unauthorized', 401);

  await env.DB.prepare(
    `UPDATE messages SET deleted_by_sender = 1 WHERE sender_id = ? AND receiver_id = ?`
  ).bind(session.user_id, friendId).run();

  await env.DB.prepare(
    `UPDATE messages SET deleted_by_receiver = 1 WHERE sender_id = ? AND receiver_id = ?`
  ).bind(friendId, session.user_id).run();

  await env.DB.prepare(
    `DELETE FROM messages WHERE deleted_by_sender = 1 AND deleted_by_receiver = 1
     AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))`
  ).bind(session.user_id, friendId, friendId, session.user_id).run();

  return ok({ message: 'Conversation deleted' });
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
