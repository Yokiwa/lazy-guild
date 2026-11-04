import type { GuildData, Run, RunStatus, Stat } from '../src/types';

let n = 0;
export function makeRun(date: string, status: RunStatus, opts: { stat?: Stat; quick?: boolean; questId?: string } = {}): Run {
  const startedAt = new Date(`${date}T10:00:00`).toISOString();
  const stat = opts.stat ?? 'STR';
  return {
    id: `r${n++}`, questId: opts.questId ?? `q-${stat}`, slotId: null, occurrenceDate: null, startedAt,
    plannedMinutes: 60, endsAt: startedAt, status, quick: opts.quick ?? false,
    reward: status === 'done' || status === 'partial' ? { xp: 30, gold: 15, stat, statPoints: 2 } : null,
    settledAt: status === 'active' ? null : startedAt,
  };
}

export const sample: GuildData = {
  profile: {
    id: 'me', name: 'Ray', species: 'slime', createdAt: '2026-11-02T13:00:00.000Z', totalXp: 120, gold: 40,
    stats: { STR: 4, INT: 2, SKL: 0 }, owned: ['hat_leaf'],
    equipped: { hat: 'hat_leaf', cape: null, background: null, title: null },
    badges: ['first_done'], claimedMilestones: [], tokenPurchases: [], lastBackupAt: null,
  },
  quests: [
    { id: 'q-STR', name: '健身', stat: 'STR', minutes: 120, icon: '💪', archived: false },
    { id: 'q-INT', name: '学习一小时', stat: 'INT', minutes: 60, icon: '📚', archived: false },
  ],
  slots: [{ id: 's1', weekdays: [1, 3, 5], time: '19:00', questIds: ['q-STR', 'q-INT'] }],
  runs: [makeRun('2026-11-02', 'done')],
};
