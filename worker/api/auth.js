// worker/api/auth.js
import { nanoid } from 'nanoid';

const TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// POST /api/auth/send-link
export async function sendMagicLink(request, env) {
  const { email } = await request.json();
  if (!email?.includes('@')) return err('Invalid email', 400);

  const token = nanoid(32);
  const expires_at = Date.now() + TOKEN_EXPIRY_MS;

  // Store token in D1
  await env.DB.prepare(
    'INSERT INTO auth_tokens (token, email, expires_at) VALUES (?, ?, ?)'
  ).bind(token, email.toLowerCase(), expires_at).run();

  // Send magic link via Resend
  const magicLink = `${env.APP_URL}/auth/verify?token=${token}`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'VoiceBridge <noreply@yourdomain.com>',
      to: email,
      subject: 'Your VoiceBridge login link',
      html: `
        <h2>Login to VoiceBridge</h2>
        <p>Click the link below to log in. This link expires in 15 minutes.</p>
        <a href="${magicLink}" style="
          background:#38bdf8;
          color:#000;
          padding:12px 24px;
          border-radius:8px;
          text-decoration:none;
          font-weight:bold;
          display:inline-block;
        ">Login to VoiceBridge</a>
        <p style="color:#666;font-size:12px;">If you didn't request this, ignore this email.</p>
      `,
    }),
  });

  if (!res.ok) return err('Failed to send email', 500);
  return ok({ message: 'Magic link sent! Check your email.' });
}

// GET /api/auth/verify?token=xxx
export async function verifyMagicLink(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return err('Missing token', 400);

  // Find token in D1
  const row = await env.DB.prepare(
    'SELECT * FROM auth_tokens WHERE token = ? AND used = 0'
  ).bind(token).first();

  if (!row) return err('Invalid or expired token', 401);
  if (Date.now() > row.expires_at) return err('Token expired', 401);

  // Mark token as used
  await env.DB.prepare(
    'UPDATE auth_tokens SET used = 1 WHERE token = ?'
  ).bind(token).run();

  // Check if user exists
  let user = await env.DB.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).bind(row.email).first();

  // If new user — create profile
  if (!user) {
    const id = nanoid();
    const username = row.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') + nanoid(4);
    await env.DB.prepare(
      'INSERT INTO users (id, username, display_name, email, language, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, username, username, row.email, 'en', Date.now()).run();
    user = { id, username, display_name: username, email: row.email, language: 'en' };
  }

  // Create session
  const sessionToken = nanoid(48);
  const sessionExpiry = Date.now() + SESSION_EXPIRY_MS;
  await env.DB.prepare(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(sessionToken, user.id, sessionExpiry).run();

  return ok({
    session_token: sessionToken,
    user: { id: user.id, username: user.username, display_name: user.display_name, language: user.language },
    is_new_user: !user.display_name,
  });
}

// POST /api/auth/logout
export async function logout(request, env) {
  const token = getSessionToken(request);
  if (token) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }
  return ok({ message: 'Logged out' });
}

// Helper: validate session and return user
export async function requireAuth(request, env) {
  const token = getSessionToken(request);
  if (!token) return null;

  const session = await env.DB.prepare(
    'SELECT s.*, u.id as user_id, u.username, u.display_name, u.email, u.language FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?'
  ).bind(token).first();

  if (!session) return null;
  if (Date.now() > session.expires_at) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return null;
  }

  return session;
}

function getSessionToken(request) {
  const auth = request.headers.get('Authorization');
  return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
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
