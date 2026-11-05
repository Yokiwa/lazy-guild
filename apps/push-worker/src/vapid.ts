import type { Env } from './env';

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

function b64url(bytes: ArrayBuffer): string {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Keys from env vars when both are set; otherwise a key pair generated on first use and
 * stored in D1, so a fresh deployment needs no manual key setup.
 */
export async function getVapidKeys(env: Env): Promise<VapidKeys> {
  const subject = env.VAPID_SUBJECT || 'mailto:lazy-guild@example.com';
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY)
    return { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject };

  const stored = await env.DB.prepare("SELECT value FROM settings WHERE key = 'vapid'").first<{ value: string }>();
  if (stored) return { ...(JSON.parse(stored.value) as Omit<VapidKeys, 'subject'>), subject };

  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const publicKey = b64url((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer);
  const privateKey = ((await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey).d!;
  // INSERT OR IGNORE + re-read: if two requests race, both end up with the same stored pair.
  await env.DB.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('vapid', ?)")
    .bind(JSON.stringify({ publicKey, privateKey }))
    .run();
  const winner = (await env.DB.prepare("SELECT value FROM settings WHERE key = 'vapid'").first<{ value: string }>())!;
  return { ...(JSON.parse(winner.value) as Omit<VapidKeys, 'subject'>), subject };
}
