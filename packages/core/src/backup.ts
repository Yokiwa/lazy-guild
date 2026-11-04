import { z } from 'zod';
import { QUEST_MINUTES_MAX, QUEST_MINUTES_MIN, SLOT_CANDIDATES_MAX } from './balance';
import type { GuildData } from './types';

export const BACKUP_VERSION = 1;
export const BACKUP_MAX_BYTES = 5_000_000;

export interface BackupFile {
  app: 'lazy-guild';
  version: 1;
  exportedAt: string;
  data: GuildData;
}

export type BackupError = 'too_large' | 'not_json' | 'wrong_app' | 'newer_version' | 'invalid';

const stat = z.enum(['STR', 'INT', 'SKL']);
const iso = z.string().refine((s) => !Number.isNaN(Date.parse(s)));
const nonNeg = z.number().int().nonnegative();

const reward = z.object({ xp: nonNeg, gold: nonNeg, stat, statPoints: nonNeg });
const run = z.object({
  id: z.string().min(1),
  questId: z.string().min(1),
  slotId: z.string().nullable(),
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  startedAt: iso,
  plannedMinutes: z.number().int().min(QUEST_MINUTES_MIN).max(QUEST_MINUTES_MAX),
  endsAt: iso,
  status: z.enum(['active', 'done', 'partial', 'skipped', 'abandoned']),
  quick: z.boolean(),
  reward: reward.nullable(),
  settledAt: iso.nullable(),
});
const quest = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(40),
  stat,
  minutes: z.number().int().min(QUEST_MINUTES_MIN).max(QUEST_MINUTES_MAX),
  icon: z.string().max(16),
  archived: z.boolean(),
});
const slot = z.object({
  id: z.string().min(1),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  // archiving a quest can leave a slot below the minimum; the plan page flags it, so allow ≥ 0 here
  questIds: z.array(z.string()).max(SLOT_CANDIDATES_MAX),
});
const profile = z.object({
  id: z.literal('me'),
  name: z.string().trim().min(1).max(20),
  species: z.enum(['slime', 'foxfire', 'drake']),
  createdAt: iso,
  totalXp: nonNeg,
  gold: nonNeg,
  stats: z.object({ STR: nonNeg, INT: nonNeg, SKL: nonNeg }),
  owned: z.array(z.string()),
  equipped: z.object({
    hat: z.string().nullable(),
    cape: z.string().nullable(),
    background: z.string().nullable(),
    title: z.string().nullable(),
  }),
  badges: z.array(z.string()),
  claimedMilestones: z.array(nonNeg),
  tokenPurchases: z.array(iso),
  lastBackupAt: iso.nullable(),
});
const guildData = z
  .object({ profile, quests: z.array(quest), slots: z.array(slot), runs: z.array(run) })
  .refine((d) => {
    const ids = new Set(d.quests.map((q) => q.id));
    return d.runs.every((r) => ids.has(r.questId)) && d.slots.every((s) => s.questIds.every((q) => ids.has(q)));
  });

export function makeBackup(data: GuildData, now: Date): BackupFile {
  return { app: 'lazy-guild', version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}

export function parseBackup(text: string): { ok: true; data: GuildData } | { ok: false; error: BackupError } {
  if (text.length > BACKUP_MAX_BYTES) return { ok: false, error: 'too_large' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'not_json' };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw) || (raw as { app?: unknown }).app !== 'lazy-guild')
    return { ok: false, error: 'wrong_app' };
  const version = (raw as { version?: unknown }).version;
  if (typeof version === 'number' && version > BACKUP_VERSION) return { ok: false, error: 'newer_version' };
  if (version !== BACKUP_VERSION) return { ok: false, error: 'invalid' };
  const parsed = guildData.safeParse((raw as { data?: unknown }).data);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  return { ok: true, data: parsed.data as GuildData };
}
