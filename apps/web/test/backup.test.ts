import { parseBackup } from '@lazy-guild/core';
import { db, loadGuildData, resetDb } from '../src/db';
import { exportBackupFile, importBackupText } from '../src/services/backup';
import { createProfile } from '../src/services/guild';
import { setNow } from './helpers';

beforeEach(async () => {
  await resetDb();
  setNow(2026, 11, 9, 18, 0);
  await createProfile('Ray', 'slime', 'zh');
});
afterEach(() => vi.useRealTimers());

test('export produces a valid backup and records the time', async () => {
  const blob = await exportBackupFile();
  const parsed = parseBackup(await blob.text());
  expect(parsed.ok).toBe(true);
  expect((await db.profile.get('me'))!.lastBackupAt).toBe(new Date(2026, 10, 9, 18, 0).toISOString());
});

test('import replaces data and keeps a pre-import export', async () => {
  const text = await (await exportBackupFile()).text();
  await db.profile.update('me', { name: 'Changed', gold: 999 });
  const res = await importBackupText(text);
  expect(res.ok).toBe(true);
  if (!res.ok) return;
  const before = parseBackup(await res.preImport.text());
  expect(before.ok && before.data.profile.name).toBe('Changed');
  expect((await db.profile.get('me'))!.name).toBe('Ray');
});

test('bad import leaves data untouched (Review Focus 5)', async () => {
  const snapshot = await loadGuildData();
  expect(await importBackupText('{}')).toEqual({ ok: false, error: 'wrong_app' });
  expect(await importBackupText('nope')).toEqual({ ok: false, error: 'not_json' });
  expect(await loadGuildData()).toEqual(snapshot);
});
