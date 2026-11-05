import { authorize, generateSecret, hashSecret } from './auth';
import type { Env } from './env';
import { getVapidKeys } from './vapid';

export const MAX_DEVICES = 20;
export const MAX_ONE_OFFS_PER_DEVICE = 10;
import { DeviceBody, HttpError, OneOffBody, SlotsBody, readJson } from './validate';

/** The app is served from the same origin; CORS only matters for local dev against another origin. */
function cors(env: Env): Record<string, string> {
  if (!env.ALLOWED_ORIGIN) return {};
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (env: Env, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(env), 'Content-Type': 'application/json' } });
const empty = (env: Env, status: number) => new Response(null, { status, headers: cors(env) });

export async function deleteDevice(env: Env, id: string): Promise<void> {
  await env.DB.batch(
    ['devices WHERE id', 'slot_times WHERE device_id', 'one_offs WHERE device_id', 'sent_log WHERE device_id'].map((t) =>
      env.DB.prepare(`DELETE FROM ${t} = ?`).bind(id),
    ),
  );
}

export async function handleRequest(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') return empty(env, 204);
  const full = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
  if (full !== '/api' && !full.startsWith('/api/')) return json(env, { error: 'not found' }, 404);
  const path = full.slice('/api'.length) || '/';
  try {
    if (req.method === 'GET' && path === '/vapid-public-key') return json(env, { key: (await getVapidKeys(env)).publicKey });

    if (req.method === 'POST' && path === '/devices') {
      const body = await readJson(req, DeviceBody);
      // Same endpoint = same browser re-registering (e.g. lost credentials): replace the old device.
      const old = await env.DB.prepare('SELECT id FROM devices WHERE endpoint = ?')
        .bind(body.subscription.endpoint)
        .first<{ id: string }>();
      if (old) await deleteDevice(env, old.id);
      const total = (await env.DB.prepare('SELECT COUNT(*) AS n FROM devices').first<{ n: number }>())!.n;
      if (total >= MAX_DEVICES) return json(env, { error: 'too many devices' }, 429);
      const id = crypto.randomUUID();
      const secret = generateSecret();
      await env.DB.prepare(
        'INSERT INTO devices (id, secret_hash, endpoint, p256dh, auth, tz, lang, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
        .bind(id, await hashSecret(secret), body.subscription.endpoint, body.subscription.keys.p256dh,
          body.subscription.keys.auth, body.tz, body.lang, new Date().toISOString())
        .run();
      return json(env, { id, secret }, 201);
    }

    const m = /^\/devices\/([^/]+)(?:\/(slots|one-offs)(?:\/([^/]+))?)?$/.exec(path);
    if (!m) return json(env, { error: 'not found' }, 404);
    const [, id, sub, oid] = m as unknown as [string, string, string | undefined, string | undefined];

    const access = await authorize(req, env, id);
    if (access === 'missing') return json(env, { error: 'unknown device' }, 404);
    if (access === 'unauthorized') return json(env, { error: 'unauthorized' }, 401);

    if (!sub && req.method === 'PUT') {
      const body = await readJson(req, DeviceBody);
      await env.DB.prepare('UPDATE devices SET endpoint = ?, p256dh = ?, auth = ?, tz = ?, lang = ? WHERE id = ?')
        .bind(body.subscription.endpoint, body.subscription.keys.p256dh, body.subscription.keys.auth, body.tz, body.lang, id)
        .run();
      return empty(env, 204);
    }
    if (!sub && req.method === 'DELETE') {
      await deleteDevice(env, id);
      return empty(env, 204);
    }
    if (sub === 'slots' && !oid && req.method === 'PUT') {
      const { slots } = await readJson(req, SlotsBody);
      const stmts = [env.DB.prepare('DELETE FROM slot_times WHERE device_id = ?').bind(id)];
      for (const s of slots)
        for (const day of new Set(s.weekdays))
          stmts.push(
            env.DB.prepare('INSERT OR REPLACE INTO slot_times (device_id, slot_id, weekday, hhmm) VALUES (?, ?, ?, ?)')
              .bind(id, s.slotId, day, s.time),
          );
      await env.DB.batch(stmts);
      return empty(env, 204);
    }
    if (sub === 'one-offs' && oid && req.method === 'PUT') {
      const body = await readJson(req, OneOffBody);
      const existing = await env.DB.prepare('SELECT 1 FROM one_offs WHERE device_id = ? AND id = ?').bind(id, oid).first();
      const count = (await env.DB.prepare('SELECT COUNT(*) AS n FROM one_offs WHERE device_id = ?').bind(id).first<{ n: number }>())!.n;
      if (!existing && count >= MAX_ONE_OFFS_PER_DEVICE) return json(env, { error: 'too many reminders' }, 429);
      await env.DB.prepare('INSERT OR REPLACE INTO one_offs (device_id, id, at, kind, run_id) VALUES (?, ?, ?, ?, ?)')
        .bind(id, oid, new Date(body.at).toISOString(), body.kind, body.runId)
        .run();
      return empty(env, 204);
    }
    if (sub === 'one-offs' && oid && req.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM one_offs WHERE device_id = ? AND id = ?').bind(id, oid).run();
      return empty(env, 204);
    }
    return json(env, { error: 'not found' }, 404);
  } catch (e) {
    if (e instanceof HttpError) return json(env, { error: e.message }, e.status);
    console.error(e);
    return json(env, { error: 'internal error' }, 500);
  }
}
