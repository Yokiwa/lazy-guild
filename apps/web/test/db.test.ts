import { loadGuildData, replaceGuildData, resetDb } from '../src/db';
import type { GuildData } from '@lazy-guild/core';

const sample: GuildData = {
  profile: {
    id: 'me', name: 'Ray', species: 'slime', createdAt: '2026-11-02T13:00:00.000Z', totalXp: 0, gold: 0,
    stats: { STR: 0, INT: 0, SKL: 0 }, owned: [], equipped: { hat: null, cape: null, background: null, title: null },
    badges: [], claimedMilestones: [], tokenPurchases: [], lastBackupAt: null,
  },
  quests: [{ id: 'q1', name: '健身', stat: 'STR', minutes: 120, icon: '💪', archived: false }],
  slots: [{ id: 's1', weekdays: [1], time: '19:00', questIds: ['q1', 'q1b'] }],
  runs: [],
};

beforeEach(() => resetDb());

test('loadGuildData returns null before onboarding', async () => {
  expect(await loadGuildData()).toBeNull();
});
test('replaceGuildData round trip', async () => {
  await replaceGuildData(sample);
  expect(await loadGuildData()).toEqual(sample);
});
test('replaceGuildData clears previous rows', async () => {
  await replaceGuildData({ ...sample, quests: [...sample.quests, { ...sample.quests[0]!, id: 'q2' }] });
  await replaceGuildData(sample);
  expect((await loadGuildData())!.quests).toHaveLength(1);
});
