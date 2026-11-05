import { SELF, env } from 'cloudflare:test';
import { getVapidKeys } from '../src/vapid';
import type { Env } from '../src/env';

test('without configured keys, a key pair is generated once and reused', async () => {
  const bare = { ...env, VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '' } as Env;
  const a = await getVapidKeys(bare);
  const b = await getVapidKeys(bare);
  expect(a.publicKey).toMatch(/^[A-Za-z0-9_-]{87}$/); // 65-byte raw P-256 key, base64url
  expect(a.privateKey).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32-byte JWK "d"
  expect(b).toEqual(a);
});

test('configured keys win over stored ones', async () => {
  const keys = await getVapidKeys({ ...env, VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' } as Env);
  expect(keys).toMatchObject({ publicKey: 'pub', privateKey: 'priv' });
});

test('API lives under /api', async () => {
  const res = await SELF.fetch('https://w/api/vapid-public-key');
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ key: 'test-public-key' });
});
