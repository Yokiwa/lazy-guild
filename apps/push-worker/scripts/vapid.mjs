// Generates a VAPID key pair for Web Push.
// Public key → wrangler.toml [vars] VAPID_PUBLIC_KEY; private JWK → `wrangler secret put VAPID_PRIVATE_KEY`.
const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
]);
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', publicKey));
const b64url = Buffer.from(raw).toString('base64url');
const jwk = await crypto.subtle.exportKey('jwk', privateKey);
console.log('VAPID_PUBLIC_KEY (put in wrangler.toml [vars]):');
console.log(b64url);
console.log('\nVAPID_PRIVATE_KEY (run `pnpm exec wrangler secret put VAPID_PRIVATE_KEY` and paste this):');
console.log(JSON.stringify(jwk));
