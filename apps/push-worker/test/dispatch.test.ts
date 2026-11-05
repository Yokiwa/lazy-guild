import { env } from 'cloudflare:test';
import { runDispatch } from '../src/dispatch';
import type { NotificationPayload, PushSender } from '../src/push';

function fakeSender(status = 201) {
  const calls: { endpoint: string; payload: NotificationPayload }[] = [];
  const sender: PushSender & { status: number } = {
    status,
    async send(sub, payload) {
      calls.push({ endpoint: sub.endpoint, payload });
      return { status: this.status };
    },
  };
  return { sender, calls };
}

async function addDevice(id: string, lang: 'zh' | 'en' = 'zh') {
  await env.DB.prepare("INSERT INTO devices VALUES (?, 'h', ?, 'p', 'a', 'America/New_York', ?, 'x')")
    .bind(id, `https://push.example/${id}`, lang)
    .run();
}
const addSlot = (id: string) =>
  env.DB.prepare("INSERT INTO slot_times VALUES (?, 'a', 1, '19:00')").bind(id).run();
const rows = async (table: string) => (await env.DB.prepare(`SELECT * FROM ${table}`).all()).results;

beforeEach(async () => {
  await env.DB.batch(['devices', 'slot_times', 'one_offs', 'sent_log'].map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
});

const at19 = Date.parse('2026-11-10T00:00:05Z'); // Monday 19:00 New York

test('sends slot once even if cron runs repeatedly', async () => {
  await addDevice('d1');
  await addSlot('d1');
  const { sender, calls } = fakeSender();
  for (let i = 0; i < 3; i++) await runDispatch(env, new Date(at19 + i * 60000), sender);
  expect(calls).toHaveLength(1);
  expect(calls[0]!.payload).toMatchObject({ kind: 'slot', url: '/choose?slot=a&date=2026-11-09', tag: 'slot:a@2026-11-09' });
});

test('payload language follows device lang and has no quest names', async () => {
  await addDevice('d1', 'en');
  await addSlot('d1');
  const { sender, calls } = fakeSender();
  await runDispatch(env, new Date(at19), sender);
  expect(calls[0]!.payload.title).toBe('⚔️ A new quest has arrived!');
  expect(calls[0]!.payload.body).toBe('Tap to pick one');
});

test('one-off sent when due, then deleted', async () => {
  await addDevice('d1');
  await env.DB.prepare("INSERT INTO one_offs VALUES ('d1', 'run1', '2026-11-10T02:00:00.000Z', 'confirm', 'run1')").run();
  const { sender, calls } = fakeSender();
  await runDispatch(env, new Date('2026-11-10T01:59:00Z'), sender);
  expect(calls).toHaveLength(0);
  await runDispatch(env, new Date('2026-11-10T02:00:20Z'), sender);
  expect(calls).toHaveLength(1);
  expect(calls[0]!.payload).toMatchObject({ kind: 'confirm', url: '/confirm?run=run1', title: '委托完成了吗？' });
  expect(await rows('one_offs')).toHaveLength(0);
});

test('410 removes device', async () => {
  await addDevice('d1');
  await addSlot('d1');
  const { sender } = fakeSender(410);
  const result = await runDispatch(env, new Date(at19), sender);
  expect(result.removed).toBe(1);
  for (const t of ['devices', 'slot_times', 'sent_log']) expect(await rows(t)).toHaveLength(0);
});

test('500 keeps one-off for retry, gives up after an hour', async () => {
  await addDevice('d1');
  await env.DB.prepare("INSERT INTO one_offs VALUES ('d1', 'run1', '2026-11-10T02:00:00.000Z', 'confirm', 'run1')").run();
  const { sender, calls } = fakeSender(500);
  await runDispatch(env, new Date('2026-11-10T02:01:00Z'), sender);
  expect(await rows('one_offs')).toHaveLength(1);
  expect(await rows('devices')).toHaveLength(1);
  await runDispatch(env, new Date('2026-11-10T03:01:00Z'), sender);
  expect(await rows('one_offs')).toHaveLength(0);
  expect(calls).toHaveLength(2);
});

test('sender throwing does not stop other devices', async () => {
  await addDevice('d1');
  await addDevice('d2');
  await addSlot('d1');
  await addSlot('d2');
  const calls: string[] = [];
  const sender: PushSender = {
    async send(sub) {
      calls.push(sub.endpoint);
      if (sub.endpoint.endsWith('d1')) throw new Error('network');
      return { status: 201 };
    },
  };
  const res = await runDispatch(env, new Date(at19), sender);
  expect(calls).toHaveLength(2);
  expect(res.sent).toBe(1);
});

test('old sent_log rows are pruned', async () => {
  await addDevice('d1');
  await env.DB.prepare("INSERT INTO sent_log VALUES ('d1', 'old', '2026-11-01T00:00:00.000Z')").run();
  await runDispatch(env, new Date(at19), fakeSender().sender);
  expect(await rows('sent_log')).toHaveLength(0);
});

test('a failed slot push is retried on the next minute (review)', async () => {
  await addDevice('d1');
  await addSlot('d1');
  const { sender, calls } = fakeSender(500);
  await runDispatch(env, new Date(at19), sender);
  sender.status = 201;
  await runDispatch(env, new Date(at19 + 60000), sender);
  await runDispatch(env, new Date(at19 + 120000), sender);
  expect(calls).toHaveLength(2);
});
