import type { Env } from './env';

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateSecret(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 'ok' | 'unauthorized' (bad/missing secret) | 'missing' (no such device) */
export async function authorize(req: Request, env: Env, deviceId: string): Promise<'ok' | 'unauthorized' | 'missing'> {
  const row = await env.DB.prepare('SELECT secret_hash FROM devices WHERE id = ?')
    .bind(deviceId)
    .first<{ secret_hash: string }>();
  if (!row) return 'missing';
  const header = req.headers.get('Authorization') ?? '';
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return 'unauthorized';
  const hash = await hashSecret(match[1]!);
  // constant-time compare of equal-length hex strings
  let diff = hash.length ^ row.secret_hash.length;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ (row.secret_hash.charCodeAt(i) || 0);
  return diff === 0 ? 'ok' : 'unauthorized';
}
