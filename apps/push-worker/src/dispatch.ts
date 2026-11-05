import { dueSlotKeys, type SlotRow } from './due';
import type { Env } from './env';
import { confirmMessage, slotMessage } from './messages';
import type { NotificationPayload, PushSender, PushTarget } from './push';
import { deleteDevice } from './routes';

const GIVE_UP_MS = 60 * 60_000;
const SENT_LOG_TTL_MS = 3 * 24 * 60 * 60_000;

interface DeviceRow extends PushTarget {
  id: string;
  tz: string;
  lang: string;
}
interface OneOffRow {
  device_id: string;
  id: string;
  at: string;
  run_id: string;
}

async function trySend(sender: PushSender, d: PushTarget, p: NotificationPayload): Promise<number> {
  try {
    return (await sender.send(d, p)).status;
  } catch (e) {
    console.error('push send failed', e);
    return 0;
  }
}
const ok = (s: number) => s >= 200 && s < 300;
const gone = (s: number) => s === 404 || s === 410;

export async function runDispatch(env: Env, now: Date, sender: PushSender): Promise<{ sent: number; removed: number }> {
  let sent = 0;
  let removed = 0;
  const nowIso = now.toISOString();
  const devices = (await env.DB.prepare('SELECT id, endpoint, p256dh, auth, tz, lang FROM devices').all<DeviceRow>()).results;
  const slotRows = (
    await env.DB.prepare('SELECT device_id, slot_id, weekday, hhmm FROM slot_times').all<SlotRow & { device_id: string }>()
  ).results;
  const dueOneOffs = (
    await env.DB.prepare('SELECT device_id, id, at, run_id FROM one_offs WHERE at <= ?').bind(nowIso).all<OneOffRow>()
  ).results;

  for (const d of devices) {
    let alive = true;
    const rows = slotRows.filter((r) => r.device_id === d.id);
    for (const due of dueSlotKeys(rows, d.tz, now)) {
      const claim = await env.DB.prepare('INSERT OR IGNORE INTO sent_log (device_id, key, sent_at) VALUES (?, ?, ?)')
        .bind(d.id, due.key, nowIso)
        .run();
      if (!claim.meta.changes) continue;
      const status = await trySend(sender, d, {
        kind: 'slot', ...slotMessage(d.lang),
        url: `/choose?slot=${encodeURIComponent(due.slotId)}&date=${due.date}`, tag: `slot:${due.key}`,
      });
      if (ok(status)) sent++;
      if (gone(status)) {
        alive = false;
        break;
      }
      if (!ok(status)) {
        // transient failure: release the claim so the lookback window retries next minute
        await env.DB.prepare('DELETE FROM sent_log WHERE device_id = ? AND key = ?').bind(d.id, due.key).run();
      }
    }
    if (!alive) {
      await deleteDevice(env, d.id);
      removed++;
      continue;
    }
    for (const o of dueOneOffs.filter((x) => x.device_id === d.id)) {
      const status = await trySend(sender, d, {
        kind: 'confirm', ...confirmMessage(d.lang),
        url: `/confirm?run=${encodeURIComponent(o.run_id)}`, tag: `confirm:${o.run_id}`,
      });
      if (gone(status)) {
        alive = false;
        break;
      }
      if (ok(status)) sent++;
      if (ok(status) || now.getTime() - Date.parse(o.at) >= GIVE_UP_MS) {
        await env.DB.prepare('DELETE FROM one_offs WHERE device_id = ? AND id = ?').bind(d.id, o.id).run();
      }
    }
    if (!alive) {
      await deleteDevice(env, d.id);
      removed++;
    }
  }

  await env.DB.prepare('DELETE FROM sent_log WHERE sent_at < ?')
    .bind(new Date(now.getTime() - SENT_LOG_TTL_MS).toISOString())
    .run();
  return { sent, removed };
}
