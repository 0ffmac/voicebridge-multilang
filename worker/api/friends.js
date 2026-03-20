// worker/api/friends.js
import { requireAuth } from './auth.js';
import { nanoid } from 'nanoid';

// GET /api/friends — list accepted friends
export async function listFriends(request, env) {
  const session = await requireAuth(request, env);
  if (!session) return err('Unauthorized', 401);

  const results = await env.DB.prepare(`
    SELECT
      f.id, f.status, f.created_at,
      u.id as user_id, u.username, u.display_name, u.language
    FROM friends f
    JOIN users u ON (
      CASE WHEN f.requester_id = ? THEN f.receiver_id ELSE f.requester_id END = u.id
    )
    WHERE (f.requester_id = ? OR f.receiver_id = ?)
    AND f.status = 'accepted'
    ORDER BY u.display_name ASC
  `).bind(session.user_id, session.user_id, session.user_id).all();

  return ok({ friends: results.results });
}

// GET /api/friends/pending — incoming friend requests
export async function pendingRequests(request, env) {
  const session = await requireAuth(request, env);
  if (!session) return err('Unauthorized', 401);

  const results = await env.DB.prepare(`
    SELECT f.id, f.created_at, u.id as user_id, u.username, u.display_name
    FROM friends f
    JOIN users u ON f.requester_id = u.id
    WHERE f.receiver_id = ? AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `).bind(session.user_id).all();

  return ok({ requests: results.results });
}

// POST /api/friends/invite — send friend request
export async function sendInvite(request, env) {
  const session = await requireAuth(request, env);
  if (!session) return err('Unauthorized', 401);

  const { receiver_id } = await request.json();
  if (!receiver_id) return err('Missing receiver_id', 400);
  if (receiver_id === session.user_id) return err('Cannot add yourself', 400);

  // Check if already friends or pending
  const existing = await env.DB.prepare(
    `SELECT id, status FROM friends
     WHERE (requester_id = ? AND receiver_id = ?)
     OR (requester_id = ? AND receiver_id = ?)`
  ).bind(session.user_id, receiver_id, receiver_id, session.user_id).first();

  if (existing) {
    if (existing.status === 'accepted') return err('Already friends', 409);
    if (existing.status === 'pending') return err('Request already sent', 409);
  }

  await env.DB.prepare(
    'INSERT INTO friends (id, requester_id, receiver_id, status, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(nanoid(), session.user_id, receiver_id, 'pending', Date.now()).run();

  return ok({ message: 'Friend request sent' });
}

// POST /api/friends/:id/accept
export async function acceptInvite(request, env, friendId) {
  const session = await requireAuth(request, env);
  if (!session) return err('Unauthorized', 401);

  const result = await env.DB.prepare(
    `UPDATE friends SET status = 'accepted'
     WHERE id = ? AND receiver_id = ? AND status = 'pending'`
  ).bind(friendId, session.user_id).run();

  if (result.changes === 0) return err('Request not found', 404);
  return ok({ message: 'Friend request accepted' });
}

// POST /api/friends/:id/decline
export async function declineInvite(request, env, friendId) {
  const session = await requireAuth(request, env);
  if (!session) return err('Unauthorized', 401);

  await env.DB.prepare(
    'DELETE FROM friends WHERE id = ? AND receiver_id = ?'
  ).bind(friendId, session.user_id).run();

  return ok({ message: 'Friend request declined' });
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
