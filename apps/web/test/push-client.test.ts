import { db, kvGet, kvSet, resetDb } from '../src/db';
import { pushClient } from '../src/push/client';
import { createProfile } from '../src/services/guild';
import { saveSlot } from '../src/services/plan';

const API = 'https://push.test';
type Call = { method: string; path: string; body: unknown; auth: string | null };
let calls: Call[];
let failNetwork: boolean;
let statusFor: (method: string, path: string) => number;
let currentSub: { endpoint: string; toJSON(): unknown; unsubscribe(): Promise<boolean> } | null;

function installBrowser(permission: NotificationPermission = 'granted') {
  const makeSub = (endpoint: string) => ({
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: 'p256', auth: 'auth' } }),
    unsubscribe: vi.fn(async () => true),
  });
  const pushManager = {
    subscribe: vi.fn(async () => (currentSub = makeSub('https://push.example/1'))),
    getSubscription: vi.fn(async () => currentSub),
  };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({ pushManager }) } });
  Object.assign(window, {
    PushManager: function PushManager() {},
    Notification: { permission, requestPermission: vi.fn(async () => permission) },
  });
  return { pushManager, makeSub };
}

beforeEach(async () => {
  await resetDb();
  await createProfile('Ray', 'slime', 'zh');
  calls = [];
  failNetwork = false;
  currentSub = null;
  statusFor = (m, p) => (m === 'POST' && p === '/devices' ? 201 : 204);
  vi.stubEnv('VITE_PUSH_API', API);
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    if (failNetwork) throw new TypeError('Failed to fetch');
    const path = url.replace(API, '');
    const method = init.method ?? 'GET';
    calls.push({ method, path, body: init.body ? JSON.parse(String(init.body)) : null, auth: new Headers(init.headers).get('Authorization') });
    if (path === '/vapid-public-key') return Response.json({ key: 'BAjiFHspqH6QQ1be90xQdzFnT9jjqvlTwRvV3EbJ' });
    const status = statusFor(method, path);
    if (status === 201) return Response.json({ id: 'dev1', secret: 's3cret' }, { status });
    return new Response(null, { status });
  }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const quests = async () => (await db.quests.toArray()).map((q) => q.id);

test('unconfigured when VITE_PUSH_API missing', async () => {
  vi.stubEnv('VITE_PUSH_API', '');
  installBrowser();
  expect(await pushClient.status()).toBe('unconfigured');
  expect(await pushClient.enable()).toBe('unconfigured');
});

test('unsupported without PushManager, denied when permission refused', async () => {
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined });
  expect(await pushClient.status()).toBe('unsupported');
  installBrowser('denied');
  expect(await pushClient.enable()).toBe('denied');
});

test('enable registers device and syncs slots without quest names', async () => {
  const [a, b] = await quests();
  await saveSlot({ weekdays: [1, 3], time: '19:00', questIds: [a!, b!] });
  installBrowser();
  expect(await pushClient.enable()).toBe('synced');
  expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
    'GET /vapid-public-key', 'POST /devices', 'PUT /devices/dev1/slots',
  ]);
  expect(calls[1]!.body).toMatchObject({ lang: 'zh', subscription: { endpoint: 'https://push.example/1' } });
  const slotsBody = calls[2]!.body as { slots: Record<string, unknown>[] };
  expect(Object.keys(slotsBody.slots[0]!).sort()).toEqual(['slotId', 'time', 'weekdays']);
  expect(JSON.stringify(slotsBody)).not.toContain('健身');
  expect(calls[2]!.auth).toBe('Bearer s3cret');
  expect(await kvGet('pushDevice')).toMatchObject({ id: 'dev1', secret: 's3cret' });
});

test('offline ops queue, merge and flush later', async () => {
  installBrowser();
  await pushClient.enable();
  failNetwork = true;
  await pushClient.syncSlots();
  await pushClient.syncSlots();
  expect(await pushClient.status()).toBe('pending');
  expect(await kvGet('pushQueue')).toEqual([{ op: 'slots' }]);
  failNetwork = false;
  await pushClient.flush();
  expect(await pushClient.status()).toBe('synced');
  expect(await kvGet('pushQueue')).toEqual([]);
});

test('confirm followed by cancel collapses', async () => {
  installBrowser();
  await pushClient.enable();
  failNetwork = true;
  const run = { id: 'run1', endsAt: '2026-11-10T02:00:00.000Z' } as Parameters<typeof pushClient.scheduleConfirm>[0];
  await pushClient.scheduleConfirm(run);
  expect(await kvGet('pushQueue')).toEqual([{ op: 'confirm', runId: 'run1', at: '2026-11-10T02:00:00.000Z' }]);
  await pushClient.cancelConfirm('run1');
  expect(await kvGet('pushQueue')).toEqual([]);
});

test('confirm and cancel are sent when online', async () => {
  installBrowser();
  await pushClient.enable();
  calls = [];
  await pushClient.scheduleConfirm({ id: 'run1', endsAt: '2026-11-10T02:00:00.000Z' } as never);
  await pushClient.cancelConfirm('run1');
  expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['PUT /devices/dev1/one-offs/run1', 'DELETE /devices/dev1/one-offs/run1']);
  expect(calls[0]!.body).toEqual({ at: '2026-11-10T02:00:00.000Z', kind: 'confirm', runId: 'run1' });
});

test('401 clears credentials and reports off', async () => {
  installBrowser();
  await pushClient.enable();
  statusFor = () => 401;
  await pushClient.syncSlots();
  expect(await kvGet('pushDevice')).toBeUndefined();
  expect(await pushClient.status()).toBe('off');
});

test('ops are dropped when push is not enabled', async () => {
  installBrowser();
  await pushClient.syncSlots();
  expect(calls).toEqual([]);
  expect((await kvGet<unknown[]>('pushQueue')) ?? []).toEqual([]);
});

test('timezone change triggers device update on startup', async () => {
  installBrowser();
  await pushClient.enable();
  await kvSet('lastTz', 'Asia/Shanghai');
  calls = [];
  await pushClient.onStartup();
  const put = calls.find((c) => c.method === 'PUT' && c.path === '/devices/dev1');
  expect(put?.body).toMatchObject({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone, lang: 'zh' });
  expect(await kvGet('lastTz')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
});

test('lost subscription re-registers on startup when permission is granted', async () => {
  installBrowser();
  await pushClient.enable();
  currentSub = null;
  calls = [];
  await pushClient.onStartup();
  expect(calls.map((c) => `${c.method} ${c.path}`)).toContain('POST /devices');
});

test('disable deletes the device and unsubscribes', async () => {
  installBrowser();
  await pushClient.enable();
  const sub = currentSub!;
  await pushClient.disable();
  expect(calls.at(-1)).toMatchObject({ method: 'DELETE', path: '/devices/dev1' });
  expect(sub.unsubscribe).toHaveBeenCalled();
  expect(await pushClient.status()).toBe('off');
});

describe('review fixes', () => {
  test('#3 device deleted on the server: startup notices and re-registers', async () => {
    const { pushManager } = installBrowser();
    await pushClient.enable();
    const oldSub = currentSub!;
    statusFor = (m, p) => (m === 'PUT' && p === '/devices/dev1' ? 404 : m === 'POST' && p === '/devices' ? 201 : 204);
    calls = [];
    await pushClient.onStartup();
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(
      expect.arrayContaining(['PUT /devices/dev1', 'GET /vapid-public-key', 'POST /devices']),
    );
    expect(oldSub.unsubscribe).toHaveBeenCalled();
    expect(pushManager.subscribe).toHaveBeenCalledTimes(2);
    expect(await kvGet('pushDevice')).toBeDefined();
  });

  test('#4 an op queued while another is in flight is not lost', async () => {
    installBrowser();
    await pushClient.enable();
    calls = [];
    const inner = vi.mocked(fetch).getMockImplementation()!;
    let late: Promise<void> | null = null;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (!late && String(url).endsWith('/slots')) {
        late = pushClient.scheduleConfirm({ id: 'run9', endsAt: '2026-11-10T02:00:00.000Z' } as never);
        await new Promise((r) => setTimeout(r, 30));
      }
      return inner(url as string, init);
    });
    await pushClient.syncSlots();
    await late;
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['PUT /devices/dev1/slots', 'PUT /devices/dev1/one-offs/run9']);
    expect(await kvGet('pushQueue')).toEqual([]);
  });

  test('#5 requests carry a timeout signal', async () => {
    installBrowser();
    await pushClient.enable();
    for (const [, init] of vi.mocked(fetch).mock.calls) expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });
});
