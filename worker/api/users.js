// worker/api/users.js
import { requireAuth } from './auth.js';

// GET /api/users/me
export async function getMe(request, env) {
  const session = await requireAuth(request, env);
  if (!session) return err('Unauthorized', 401);

  return ok({
    id: session.user_id,
    username: session.username,
    display_name: session.display_name,
    email: session.email,
    language: session.language,
  });
}

// PUT /api/users/me
export async function updateMe(request, env) {
  const session = await requireAuth(request, env);
  if (!session) return err('Unauthorized', 401);

  const { display_name, language, username } = await request.json();

  // Check username not taken by someone else
  if (username) {
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE username = ? AND id != ?'
    ).bind(username.toLowerCase(), session.user_id).first();
    if (existing) return err('Username already taken', 409);
  }

  await env.DB.prepare(
    'UPDATE users SET display_name = COALESCE(?, display_name), language = COALESCE(?, language), username = COALESCE(?, username) WHERE id = ?'
  ).bind(display_name || null, language || null, username?.toLowerCase() || null, session.user_id).run();

  return ok({ message: 'Profile updated' });
}

// GET /api/users/search?q=username
export async function searchUsers(request, env) {
  const session = await requireAuth(request, env);
  if (!session) return err('Unauthorized', 401);

  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.toLowerCase();
  if (!q || q.length < 2) return err('Query too short', 400);

  const results = await env.DB.prepare(
    `SELECT id, username, display_name, language FROM users
     WHERE (username LIKE ? OR display_name LIKE ?)
     AND id != ?
     LIMIT 10`
  ).bind(`%${q}%`, `%${q}%`, session.user_id).all();

  return ok({ users: results.results });
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
