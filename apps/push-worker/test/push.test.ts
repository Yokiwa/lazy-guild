import { createWebPushSender } from '../src/push';
import type { Env } from '../src/env';

const b64url = (b: ArrayBuffer | Uint8Array) => {
  let s = '';
  for (const x of new Uint8Array(b)) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

test('real sender posts an encrypted, VAPID-signed request to the endpoint', async () => {
  const server = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey('jwk', server.privateKey)) as JsonWebKey;
  const client = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const env = {
    VAPID_PUBLIC_KEY: b64url((await crypto.subtle.exportKey('raw', server.publicKey)) as ArrayBuffer),
    VAPID_PRIVATE_KEY: jwk.d!,
    VAPID_SUBJECT: 'mailto:test@example.com',
  } as Env;
  const seen: Request[] = [];
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    seen.push(new Request(input as RequestInfo, init));
    return new Response(null, { status: 201 });
  });
  const sender = createWebPushSender(env);
  const res = await sender.send(
    {
      endpoint: 'https://push.example/sub1',
      p256dh: b64url((await crypto.subtle.exportKey('raw', client.publicKey)) as ArrayBuffer),
      auth: b64url(crypto.getRandomValues(new Uint8Array(16))),
    },
    { kind: 'slot', title: 't', body: 'b', url: '/choose', tag: 'slot:a@2026-11-09' },
  );
  spy.mockRestore();
  expect(res.status).toBe(201);
  expect(seen).toHaveLength(1);
  const req = seen[0]!;
  expect(req.url).toBe('https://push.example/sub1');
  expect(req.method).toBe('POST');
  expect(req.headers.get('Content-Encoding')).toBe('aes128gcm');
  expect(req.headers.get('Authorization')).toMatch(/^vapid t=.+, k=.+$/);
  expect(req.headers.get('TTL')).toBe('3600');
  expect((await req.arrayBuffer()).byteLength).toBeGreaterThan(100);
});
