import { type BackupError, localDate, makeBackup, parseBackup } from '@lazy-guild/core';
import { db, loadGuildData, replaceGuildData } from '../db';
import { now } from '../lib/clock';
import { pushClient } from '../push/client';

/** Serializes all local data; records lastBackupAt. */
export async function exportBackupFile(): Promise<Blob> {
  const data = await loadGuildData();
  if (!data) throw new Error('no profile');
  const t = now();
  const blob = new Blob([JSON.stringify(makeBackup(data, t), null, 2)], { type: 'application/json' });
  await db.profile.update('me', { lastBackupAt: t.toISOString() });
  return blob;
}

export function backupFileName(prefix = 'lazy-guild'): string {
  return `${prefix}-${localDate(now())}.json`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    // Environments without object URLs (tests) skip the download; callers still get the Blob.
  }
}

/** Validates the whole file first; on success saves a pre-import export, then replaces everything. */
export async function importBackupText(
  text: string,
): Promise<{ ok: true; preImport: Blob } | { ok: false; error: BackupError }> {
  const parsed = parseBackup(text);
  if (!parsed.ok) return parsed;
  const current = await loadGuildData();
  const t = now();
  const preImport = new Blob([JSON.stringify(current ? makeBackup(current, t) : null, null, 2)], { type: 'application/json' });
  downloadBlob(preImport, backupFileName('lazy-guild-before-import'));
  await replaceGuildData(parsed.data);
  await pushClient.syncSlots();
  return { ok: true, preImport };
}
