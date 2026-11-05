import { SELF, env } from 'cloudflare:test';

let n = 0;
const sub = () => ({ endpoint: `https://web.push.apple.com/dev${n++}`, keys: { p256dh: 'p256', auth: 'authkey' } });
const deviceBody = () => ({ subscription: sub(), tz: 'America/New_York', lang: 'zh' });
const url = (p: string) => `https://w/api${p}`;
// D1 storage is shared by the tests in this file, so every count is scoped to one device.
const count = async (table: string, deviceId: string) =>
  ((await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${table === 'devices' ? 'id' : 'device_id'} = ?`)
    .bind(deviceId)
    .first<{ n: number }>())!).n;

async function register() {
  const res = await SELF.fetch(url('/devices'), { method: 'POST', body: JSON.stringify(deviceBody()) });
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string; secret: string };
}
const auth = (secret: string) => ({ Authorization: `Bearer ${secret}` });

test('register then authorized slot replace', async () => {
  const { id, secret } = await register();
  const put = await SELF.fetch(url(`/devices/${id}/slots`), {
    method: 'PUT', headers: auth(secret),
    body: JSON.stringify({ slots: [{ slotId: 'a', weekdays: [1, 3], time: '19:00' }] }),
  });
  expect(put.status).toBe(204);
  expect(await count('slot_times', id)).toBe(2);
});

test('secret is stored hashed, never in plain text', async () => {
  const { id, secret } = await register();
  const row = await env.DB.prepare('SELECT secret_hash FROM devices WHERE id = ?').bind(id).first<{ secret_hash: string }>();
  expect(row!.secret_hash).not.toBe(secret);
  expect(row!.secret_hash).toMatch(/^[0-9a-f]{64}$/);
});

test('wrong secret is 401, unknown device is 404', async () => {
  const { id } = await register();
  const bad = await SELF.fetch(url(`/devices/${id}/slots`), { method: 'PUT', headers: auth('nope'), body: '{"slots":[]}' });
  expect(bad.status).toBe(401);
  const none = await SELF.fetch(url('/devices/ghost/slots'), { method: 'PUT', headers: auth('x'), body: '{"slots":[]}' });
  expect(none.status).toBe(404);
  const noHeader = await SELF.fetch(url(`/devices/${id}`), { method: 'DELETE' });
  expect(noHeader.status).toBe(401);
});

test('invalid tz / lang / time / endpoint / oversized body rejected', async () => {
  const post = (body: unknown) => SELF.fetch(url('/devices'), { method: 'POST', body: JSON.stringify(body) });
  expect((await post({ ...deviceBody(), tz: 'Mars/Base' })).status).toBe(400);
  expect((await post({ ...deviceBody(), lang: 'fr' })).status).toBe(400);
  expect((await post({ ...deviceBody(), subscription: { ...sub(), endpoint: 'http://insecure' } })).status).toBe(400);
  expect((await SELF.fetch(url('/devices'), { method: 'POST', body: 'not json' })).status).toBe(400);
  expect((await SELF.fetch(url('/devices'), { method: 'POST', body: 'x'.repeat(17 * 1024) })).status).toBe(413);
  const { id, secret } = await register();
  const put = await SELF.fetch(url(`/devices/${id}/slots`), {
    method: 'PUT', headers: auth(secret), body: JSON.stringify({ slots: [{ slotId: 'a', weekdays: [1], time: '25:00' }] }),
  });
  expect(put.status).toBe(400);
});

test('slots PUT replaces, not appends', async () => {
  const { id, secret } = await register();
  const put = (slots: unknown) =>
    SELF.fetch(url(`/devices/${id}/slots`), { method: 'PUT', headers: auth(secret), body: JSON.stringify({ slots }) });
  await put([{ slotId: 'a', weekdays: [1, 3, 5], time: '19:00' }]);
  await put([{ slotId: 'b', weekdays: [2], time: '08:00' }]);
  expect(await count('slot_times', id)).toBe(1);
});

test('one-off upsert and delete', async () => {
  const { id, secret } = await register();
  const body = (at: string) => JSON.stringify({ at, kind: 'confirm', runId: 'run1' });
  const put = (at: string) => SELF.fetch(url(`/devices/${id}/one-offs/run1`), { method: 'PUT', headers: auth(secret), body: body(at) });
  expect((await put('2026-11-10T02:00:00.000Z')).status).toBe(204);
  expect((await put('2026-11-10T03:00:00.000Z')).status).toBe(204);
  expect(await count('one_offs', id)).toBe(1);
  const del = await SELF.fetch(url(`/devices/${id}/one-offs/run1`), { method: 'DELETE', headers: auth(secret) });
  expect(del.status).toBe(204);
  expect(await count('one_offs', id)).toBe(0);
});

test('PUT device updates tz and lang', async () => {
  const { id, secret } = await register();
  const res = await SELF.fetch(url(`/devices/${id}`), {
    method: 'PUT', headers: auth(secret), body: JSON.stringify({ ...deviceBody(), tz: 'Asia/Tokyo', lang: 'en' }),
  });
  expect(res.status).toBe(204);
  expect(await env.DB.prepare('SELECT tz, lang FROM devices WHERE id = ?').bind(id).first()).toEqual({ tz: 'Asia/Tokyo', lang: 'en' });
});

test('DELETE device removes all rows', async () => {
  const { id, secret } = await register();
  await SELF.fetch(url(`/devices/${id}/slots`), {
    method: 'PUT', headers: auth(secret), body: JSON.stringify({ slots: [{ slotId: 'a', weekdays: [1], time: '19:00' }] }),
  });
  await SELF.fetch(url(`/devices/${id}/one-offs/r`), {
    method: 'PUT', headers: auth(secret), body: JSON.stringify({ at: '2026-11-10T02:00:00Z', kind: 'confirm', runId: 'r' }),
  });
  await env.DB.prepare("INSERT INTO sent_log VALUES (?, 'k', 'x')").bind(id).run();
  expect((await SELF.fetch(url(`/devices/${id}`), { method: 'DELETE', headers: auth(secret) })).status).toBe(204);
  for (const t of ['devices', 'slot_times', 'one_offs', 'sent_log']) expect(await count(t, id)).toBe(0);
});

test('CORS preflight and headers', async () => {
  const pre = await SELF.fetch(url('/devices'), { method: 'OPTIONS' });
  expect(pre.status).toBe(204);
  expect(pre.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');
  expect(pre.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
  const res = await SELF.fetch(url('/vapid-public-key'));
  expect(await res.json()).toEqual({ key: 'test-public-key' });
  expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');
});

test('stores no quest names', async () => {
  const { id, secret } = await register();
  await SELF.fetch(url(`/devices/${id}/slots`), {
    method: 'PUT', headers: auth(secret),
    body: JSON.stringify({ slots: [{ slotId: 'a', weekdays: [1], time: '19:00', name: '健身', questIds: ['q'] }] }),
  });
  const cols = await env.DB.prepare('PRAGMA table_info(slot_times)').all<{ name: string }>();
  expect(cols.results.map((c) => c.name)).toEqual(['device_id', 'slot_id', 'weekday', 'hhmm']);
  const dump = JSON.stringify(await env.DB.prepare('SELECT * FROM slot_times WHERE device_id = ?').bind(id).all());
  expect(dump).not.toContain('健身');
});

test('unknown route is 404', async () => {
  expect((await SELF.fetch(url('/nope'))).status).toBe(404);
});

describe('abuse limits (review #2)', () => {
  beforeEach(async () => {
    await env.DB.batch(['devices', 'slot_times', 'one_offs', 'sent_log'].map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
  });
  const post = (body: unknown) => SELF.fetch(url('/devices'), { method: 'POST', body: JSON.stringify(body) });

  test('only known push services are accepted as endpoints', async () => {
    const bad = { ...deviceBody(), subscription: { ...sub(), endpoint: 'https://attacker.example/hook' } };
    expect((await post(bad)).status).toBe(400);
    for (const host of ['web.push.apple.com', 'fcm.googleapis.com', 'updates.push.services.mozilla.com', 'wns2-by3p.notify.windows.com']) {
      const ok = { ...deviceBody(), subscription: { ...sub(), endpoint: `https://${host}/x${n++}` } };
      expect((await post(ok)).status, host).toBe(201);
    }
  });

  test('registering the same endpoint again replaces the old device', async () => {
    const body = deviceBody();
    const first = (await (await post(body)).json()) as { id: string };
    const second = (await (await post(body)).json()) as { id: string };
    expect(second.id).not.toBe(first.id);
    expect(((await env.DB.prepare('SELECT COUNT(*) AS n FROM devices').first<{ n: number }>())!).n).toBe(1);
  });

  test('device count is capped', async () => {
    for (let i = 0; i < 20; i++) expect((await post(deviceBody())).status).toBe(201);
    expect((await post(deviceBody())).status).toBe(429);
  });

  test('more than 6 distinct times on one weekday is rejected', async () => {
    const { id, secret } = await register();
    const slots = Array.from({ length: 7 }, (_, i) => ({ slotId: `s${i}`, weekdays: [1], time: `0${i}:00` }));
    const res = await SELF.fetch(url(`/devices/${id}/slots`), { method: 'PUT', headers: auth(secret), body: JSON.stringify({ slots }) });
    expect(res.status).toBe(400);
  });

  test('one-offs per device are capped', async () => {
    const { id, secret } = await register();
    const put = (i: number) =>
      SELF.fetch(url(`/devices/${id}/one-offs/r${i}`), {
        method: 'PUT', headers: auth(secret), body: JSON.stringify({ at: '2026-11-10T02:00:00Z', kind: 'confirm', runId: `r${i}` }),
      });
    for (let i = 0; i < 10; i++) expect((await put(i)).status).toBe(204);
    expect((await put(10)).status).toBe(429);
    expect((await put(0)).status).toBe(204); // updating an existing one is fine
  });
});
