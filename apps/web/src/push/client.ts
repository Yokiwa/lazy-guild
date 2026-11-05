import type { Lang, Run } from '@lazy-guild/core';
import { db, kvGet, kvSet } from '../db';

export type PushStatus = 'synced' | 'pending' | 'off' | 'unsupported' | 'unconfigured' | 'denied';
export type PushOp =
  | { op: 'slots' }
  | { op: 'confirm'; runId: string; at: string }
  | { op: 'cancel'; runId: string }
  | { op: 'device' };

interface Device {
  id: string;
  secret: string;
  endpoint: string;
}

const DEVICE = 'pushDevice';
const QUEUE = 'pushQueue';
const LAST_TZ = 'lastTz';
const READY_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 8_000;

const apiBase = (): string => String(import.meta.env.VITE_PUSH_API ?? '').replace(/\/+$/, '');
const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const supported = () =>
  typeof window !== 'undefined' &&
  !!navigator.serviceWorker &&
  'PushManager' in window &&
  'Notification' in window;

async function currentLang(): Promise<Lang> {
  return (await kvGet<Lang>('lang')) === 'en' ? 'en' : 'zh';
}

async function pushManager(): Promise<PushManager | null> {
  if (!supported()) return null;
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), READY_TIMEOUT_MS));
  const reg = await Promise.race([navigator.serviceWorker.ready, timeout]);
  return reg ? reg.pushManager : null;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function call(path: string, init: RequestInit = {}, device?: Device): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (device) headers.Authorization = `Bearer ${device.secret}`;
  return fetch(apiBase() + path, { ...init, headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

async function deviceBody(sub: PushSubscription) {
  return JSON.stringify({ subscription: sub.toJSON(), tz: timeZone(), lang: await currentLang() });
}

async function readQueue(): Promise<PushOp[]> {
  return (await kvGet<PushOp[]>(QUEUE)) ?? [];
}

/** Adds an op, collapsing ones that the new op makes redundant. */
function merge(queue: PushOp[], op: PushOp): PushOp[] {
  switch (op.op) {
    case 'slots':
    case 'device':
      return [...queue.filter((q) => q.op !== op.op), op];
    case 'confirm':
      return [...queue.filter((q) => !('runId' in q && q.runId === op.runId)), op];
    case 'cancel': {
      const pending = queue.some((q) => q.op === 'confirm' && q.runId === op.runId);
      const rest = queue.filter((q) => !('runId' in q && q.runId === op.runId));
      return pending ? rest : [...rest, op];
    }
  }
}

async function enqueue(op: PushOp): Promise<void> {
  if (!apiBase() || !(await kvGet<Device>(DEVICE))) return;
  await db.transaction('rw', db.kv, async () => kvSet(QUEUE, merge(await readQueue(), op)));
  await pushClient.flush();
}

/** Removes exactly the op that was sent, leaving anything enqueued meanwhile. */
async function dequeue(op: PushOp): Promise<void> {
  const key = JSON.stringify(op);
  await db.transaction('rw', db.kv, async () => {
    const queue = await readQueue();
    const i = queue.findIndex((q) => JSON.stringify(q) === key);
    if (i >= 0) queue.splice(i, 1);
    await kvSet(QUEUE, queue);
  });
}

/** Fire-and-forget for UI code: the quest loop must never wait on the network. */
export function inBackground(p: Promise<unknown>): void {
  p.catch((e) => console.warn('push sync failed', e));
}

async function forget(): Promise<void> {
  await db.kv.bulkDelete([DEVICE, QUEUE]);
}

/** 'ok' → done; 'stop' → retry later; 'drop' → op can never succeed; 'reset' → credentials are gone. */
async function send(op: PushOp, device: Device): Promise<'ok' | 'stop' | 'drop' | 'reset'> {
  let res: Response;
  const base = `/devices/${device.id}`;
  try {
    if (op.op === 'slots') {
      const slots = (await db.slots.toArray()).map((s) => ({ slotId: s.id, weekdays: s.weekdays, time: s.time }));
      res = await call(`${base}/slots`, { method: 'PUT', body: JSON.stringify({ slots }) }, device);
    } else if (op.op === 'confirm') {
      const body = JSON.stringify({ at: op.at, kind: 'confirm', runId: op.runId });
      res = await call(`${base}/one-offs/${encodeURIComponent(op.runId)}`, { method: 'PUT', body }, device);
    } else if (op.op === 'cancel') {
      res = await call(`${base}/one-offs/${encodeURIComponent(op.runId)}`, { method: 'DELETE' }, device);
    } else {
      const sub = await (await pushManager())?.getSubscription();
      if (!sub) return 'drop';
      res = await call(base, { method: 'PUT', body: await deviceBody(sub) }, device);
      if (res.ok) await kvSet(DEVICE, { ...device, endpoint: sub.endpoint });
    }
  } catch {
    return 'stop';
  }
  if (res.ok) return 'ok';
  if (res.status === 401 || res.status === 404) return 'reset';
  if (res.status >= 400 && res.status < 500) return 'drop';
  return 'stop';
}

let flushing: Promise<'done' | 'reset'> | null = null;

function runFlush(): Promise<'done' | 'reset'> {
  if (flushing) return flushing;
  flushing = (async (): Promise<'done' | 'reset'> => {
    for (;;) {
      const device = await kvGet<Device>(DEVICE);
      const [op] = await readQueue();
      if (!device || !op) return 'done';
      const result = await send(op, device);
      if (result === 'stop') return 'done';
      if (result === 'reset') {
        await forget();
        return 'reset';
      }
      await dequeue(op);
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

/** The server no longer knows this device (e.g. it was dropped after a 410): start over. */
async function reRegister(): Promise<void> {
  if (!supported() || Notification.permission !== 'granted') return;
  const sub = await (await pushManager())?.getSubscription();
  await sub?.unsubscribe(); // otherwise the browser hands back the same dead endpoint
  await registerDevice();
}

async function registerDevice(): Promise<PushStatus> {
  const pm = await pushManager();
  if (!pm) return 'unsupported';
  try {
    const { key } = (await (await call('/vapid-public-key')).json()) as { key: string };
    const sub = await pm.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
    const res = await call('/devices', { method: 'POST', body: await deviceBody(sub) });
    if (!res.ok) return 'off';
    const { id, secret } = (await res.json()) as { id: string; secret: string };
    await kvSet(DEVICE, { id, secret, endpoint: sub.endpoint } satisfies Device);
    await kvSet(LAST_TZ, timeZone());
    let queue: PushOp[] = [{ op: 'slots' }];
    const active = await db.runs.where('status').equals('active').first();
    if (active) queue = merge(queue, { op: 'confirm', runId: active.id, at: active.endsAt });
    await kvSet(QUEUE, queue);
  } catch {
    return 'off';
  }
  await runFlush(); // a reset here is not retried, so a broken server can't cause a loop
  return pushClient.status();
}

export const pushClient = {
  async enable(): Promise<PushStatus> {
    if (!apiBase()) return 'unconfigured';
    if (!supported()) return 'unsupported';
    // requestPermission must be the first thing after the tap (iOS needs the user gesture)
    if ((await Notification.requestPermission()) !== 'granted') return 'denied';
    return registerDevice();
  },

  async disable(): Promise<void> {
    const device = await kvGet<Device>(DEVICE);
    if (device) await call(`/devices/${device.id}`, { method: 'DELETE' }, device).catch(() => undefined);
    const sub = await (await pushManager())?.getSubscription();
    await sub?.unsubscribe();
    await forget();
  },

  syncSlots: () => enqueue({ op: 'slots' }),
  scheduleConfirm: (run: Run) => enqueue({ op: 'confirm', runId: run.id, at: run.endsAt }),
  cancelConfirm: (runId: string) => enqueue({ op: 'cancel', runId }),
  updateLang: (_lang: Lang) => enqueue({ op: 'device' }),

  async flush(): Promise<void> {
    if ((await runFlush()) === 'reset') await reRegister();
  },

  async status(): Promise<PushStatus> {
    if (!apiBase()) return 'unconfigured';
    if (!supported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    if (!(await kvGet<Device>(DEVICE))) return 'off';
    return (await readQueue()).length ? 'pending' : 'synced';
  },

  async onStartup(): Promise<void> {
    if (!apiBase() || !supported()) return;
    window.addEventListener('online', () => void pushClient.flush());
    const device = await kvGet<Device>(DEVICE);
    if (!device) return;
    const sub = await (await pushManager())?.getSubscription();
    if (!sub) {
      if (Notification.permission === 'granted') {
        await call(`/devices/${device.id}`, { method: 'DELETE' }, device).catch(() => undefined);
        await forget();
        await pushClient.enable();
      }
      return;
    }
    // Always re-announce the device: it updates tz/endpoint and reveals (via 401/404) a device
    // the server has dropped, which then re-registers.
    await kvSet(LAST_TZ, timeZone());
    await enqueue({ op: 'device' });
  },
};
