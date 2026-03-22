// worker/api/push.js
import { requireAuth } from './auth.js';
import { nanoid } from 'nanoid';

const b64url = (data) => Buffer.from(data).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
const bin = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export async function subscribe(request, env) {
  const session = await requireAuth(request, env);
  if (!session) return err('Unauthorized', 401);
  const { endpoint, keys } = await request.json();
  if (!endpoint || !keys?.p256dh || !keys?.auth) return err('Invalid subscription', 400);
  await env.DB.prepare(`
    INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, endpoint) DO UPDATE SET
      p256dh = excluded.p256dh,
      auth = excluded.auth
  `).bind(nanoid(), session.user_id, endpoint, keys.p256dh, keys.auth, Date.now()).run();
  return ok({ message: 'Subscribed' });
}

export async function unsubscribe(request, env) {
  const session = await requireAuth(request, env);
  if (!session) return err('Unauthorized', 401);
  const { endpoint } = await request.json();
  await env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?').bind(session.user_id, endpoint).run();
  return ok({ message: 'Unsubscribed' });
}

export async function testPush(request, env) {
  const session = await requireAuth(request, env);
  if (!session) return err('Unauthorized', 401);
  await sendPushToUser(env, session.user_id, { title: 'VoiceBridge', body: 'Encryption verified! ✅' });
  return ok({ message: 'Test push triggered' });
}

export async function sendPushToUser(env, userId, payload) {
  const subs = await env.DB.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').bind(userId).all();
  if (!subs.results?.length) return;
  const fix = (s) => (s || '').trim().replace(/['"]/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/[^A-Za-z0-9-_]/g, '');
  const pub = fix(env.VAPID_PUBLIC_KEY);
  const priv = fix(env.VAPID_PRIVATE_KEY);
  let email = env.VAPID_EMAIL || 'mailto:admin@voicebridge-multi.com';
  if (!email.startsWith('mailto:')) email = 'mailto:' + email;
  await Promise.allSettled(subs.results.map(sub => sendWebPush(sub, payload, pub, priv, email, env)));
}

async function sendWebPush(sub, payload, pubKey, privKey, email, env) {
  try {
    const url = new URL(sub.endpoint);
    const aud = url.host.includes('fcm.googleapis.com') ? 'https://fcm.googleapis.com' : `${url.protocol}//${url.host}`;
    const now = Math.floor(Date.now() / 1000);
    const unsigned = b64url(JSON.stringify({typ:'JWT',alg:'ES256'})) + "." + b64url(JSON.stringify({aud, exp: now + 43200, iat: now, sub: email}));
    let pKey = bin(privKey);
    if (pKey.length === 32) {
      const head = Buffer.from([0x30,0x41,0x02,0x01,0x00,0x30,0x13,0x06,0x07,0x2a,0x86,0x48,0xce,0x3d,0x02,0x01,0x06,0x08,0x2a,0x86,0x48,0xce,0x3d,0x03,0x01,0x07,0x04,0x27,0x30,0x25,0x02,0x01,0x01,0x04,0x20]);
      pKey = Buffer.concat([head, pKey]);
    }
    const key = await crypto.subtle.importKey('pkcs8', pKey, {name:'ECDSA', namedCurve:'P-256'}, false, ['sign']);
    const sig = await crypto.subtle.sign({name:'ECDSA', hash:'SHA-256'}, key, Buffer.from(unsigned));
    const jwt = unsigned + "." + b64url(Buffer.from(sig));
    const encrypted = await encryptPayload(JSON.stringify(payload), sub.p256dh, sub.auth);
    const res = await fetch(sub.endpoint, { method: 'POST', headers: { 'Authorization': `vapid t=${jwt}, k=${pubKey}`, 'TTL': '86400', 'Urgency': 'high', 'Content-Type': 'application/octet-stream', 'Content-Encoding': 'aes128gcm' }, body: encrypted });
    if (res.ok) console.log(`Push sent ✅ to ${url.host}`);
    else if (res.status === 404 || res.status === 410) await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run();
  } catch (e) { console.error('Push error:', e.message); }
}

async function encryptPayload(plaintext, p256dhB64, authB64) {
  const cPub = bin(p256dhB64);
  const aSec = bin(authB64);
  
  const sKeys = await crypto.subtle.generateKey({name:'ECDH', namedCurve:'P-256'}, true, ['deriveBits']);
  const sPub = Buffer.from(await crypto.subtle.exportKey('raw', sKeys.publicKey));
  const shared = Buffer.from(await crypto.subtle.deriveBits({name:'ECDH', public: await crypto.subtle.importKey('raw', cPub, {name:'ECDH', namedCurve:'P-256'}, false, [])}, sKeys.privateKey, 256));
  const salt = Buffer.from(crypto.getRandomValues(new Uint8Array(16)));
  
  const prk = await hkdf(aSec, shared, Buffer.concat([Buffer.from('WebPush: info\0'), cPub, sPub]), 32);
  const cek = await hkdf(salt, prk, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, prk, Buffer.from('Content-Encoding: nonce\0'), 12);

  const m = Buffer.from(plaintext);
  // Padding: 0x02 || 0x00... (none) || m
  // Chrome is strict: simple padding scheme
  const p = Buffer.concat([m, Buffer.from([2])]); 
  
  const ctx = Buffer.from(await crypto.subtle.encrypt({name:'AES-GCM', iv:nonce}, await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']), p));

  const res = Buffer.alloc(21 + 65 + ctx.length);
  salt.copy(res, 0);
  res.writeUInt32BE(ctx.length, 16); 
  res[20] = 65; 
  sPub.copy(res, 21);
  ctx.copy(res, 21 + 65);
  return res;
}

async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return Buffer.from(await crypto.subtle.deriveBits({name:'HKDF', hash:'SHA-256', salt, info}, key, len * 8));
}

function ok(d) { return new Response(JSON.stringify(d), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }); }
function err(m, s = 400) { return new Response(JSON.stringify({ error: m }), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }); }
