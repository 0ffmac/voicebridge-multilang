// src/api/client.js
import { WORKER_URL } from '../config.js';
import { session } from '../session.js';

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (session.token) headers['Authorization'] = `Bearer ${session.token}`;

  const res = await fetch(`${WORKER_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const API = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
};
