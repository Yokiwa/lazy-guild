import { db, resetDb } from '../src/db';
import {
  abandonRun, acceptQuest, buyItem, createProfile, equip, getActiveRun, guildSummary, settleRun,
} from '../src/services/guild';
import { candidatesFor, removeQuest, removeSlot, saveQuest, saveSlot } from '../src/services/plan';
import type { Run } from '@lazy-guild/core';
import { setNow } from './helpers';
import { pushClient } from '../src/push/client';

beforeEach(async () => {
  await resetDb();
  setNow(2026, 11, 9, 18, 0); // Monday
  await createProfile('Ray', 'slime', 'zh');
});
afterEach(() => vi.useRealTimers());

const questByMinutes = async (m: number) => (await db.quests.toArray()).find((q) => q.minutes === m)!;
async function accept(questId: string, extra: Partial<Parameters<typeof acceptQuest>[0]> = {}) {
  const res = await acceptQuest({ questId, slotId: null, date: null, ...extra });
  if (!res.ok) throw new Error(res.reason);
  return res.run;
}

test('createProfile seeds four localized quests', async () => {
  const quests = await db.quests.toArray();
  expect(quests.map((q) => [q.name, q.stat, q.minutes])).toEqual(
    expect.arrayContaining([['健身', 'STR', 120], ['学习一小时', 'INT', 60], ['写作业', 'INT', 90], ['推进项目', 'SKL', 60]]),
  );
  expect((await db.profile.get('me'))!).toMatchObject({ name: 'Ray', species: 'slime', totalXp: 0, gold: 0 });
});

test('accept → settle done awards xp and gold once (Review Focus 4)', async () => {
  const run = await accept((await questByMinutes(120)).id);
  expect(run).toMatchObject({ status: 'active', plannedMinutes: 120, quick: false });
  expect(Date.parse(run.endsAt) - Date.parse(run.startedAt)).toBe(120 * 60_000);
  const [a, b] = await Promise.all([settleRun(run.id, 'done'), settleRun(run.id, 'done')]);
  expect([a, b].filter(Boolean)).toHaveLength(1);
  const p = (await db.profile.get('me'))!;
  expect([p.totalXp, p.gold, p.stats.STR]).toEqual([60, 30, 4]);
  expect(await settleRun(run.id, 'partial')).toBeNull();
  expect((await db.runs.get(run.id))!.status).toBe('done');
});

test('second accept blocked unless replaceActive', async () => {
  const q = await questByMinutes(60);
  const first = await accept(q.id);
  expect(await acceptQuest({ questId: q.id, slotId: null, date: null })).toEqual({ ok: false, reason: 'active_exists' });
  const second = await accept(q.id, { replaceActive: true });
  expect((await db.runs.get(first.id))!.status).toBe('abandoned');
  expect((await db.runs.where('status').equals('active').toArray()).map((r) => r.id)).toEqual([second.id]);
});

test('archived or unknown quest cannot be accepted', async () => {
  expect(await acceptQuest({ questId: 'ghost', slotId: null, date: null })).toEqual({ ok: false, reason: 'quest_missing' });
});

test('quick flag from occurrence', async () => {
  const gym = await questByMinutes(120);
  const study = await questByMinutes(60);
  const saved = await saveSlot({ weekdays: [1], time: '19:00', questIds: [gym.id, study.id] });
  if (!saved.ok) throw new Error(saved.error);
  setNow(2026, 11, 9, 19, 10);
  const run = await accept(gym.id, { slotId: saved.id, date: '2026-11-09' });
  expect(run).toMatchObject({ quick: true, slotId: saved.id, occurrenceDate: '2026-11-09' });
  expect((await settleRun(run.id, 'done'))!.reward.xp).toBe(72);
});

test('late accept from a slot is not quick', async () => {
  const gym = await questByMinutes(120);
  const saved = (await saveSlot({ weekdays: [1], time: '19:00', questIds: [gym.id, (await questByMinutes(60)).id] })) as { id: string };
  setNow(2026, 11, 9, 19, 16);
  expect((await accept(gym.id, { slotId: saved.id, date: '2026-11-09' })).quick).toBe(false);
});

test('partial and skipped', async () => {
  const run = await accept((await questByMinutes(120)).id);
  expect((await settleRun(run.id, 'partial'))!.reward.xp).toBe(30);
  const run2 = await accept((await questByMinutes(120)).id);
  const res = await settleRun(run2.id, 'skipped');
  expect(res!.reward).toMatchObject({ xp: 0, gold: 0 });
  expect((await db.profile.get('me'))!.totalXp).toBe(30);
  expect((await db.runs.get(run2.id))!.status).toBe('skipped');
});

test('level up and rank change reported', async () => {
  await db.profile.update('me', { totalXp: 90 });
  const run = await accept((await questByMinutes(120)).id);
  const res = (await settleRun(run.id, 'done'))!;
  expect(res.delta).toMatchObject({ levelBefore: 1, levelAfter: 2 });
  expect(res.newBadges).toContain('first_done');
});

test('milestone gold claimed once', async () => {
  await db.profile.update('me', { createdAt: new Date(2026, 10, 7, 9).toISOString() });
  const prior = (day: number): Run => ({
    id: `prior${day}`, questId: (globalThis as { gymId?: string }).gymId ?? 'x', slotId: null, occurrenceDate: null,
    startedAt: new Date(2026, 10, day, 10).toISOString(), plannedMinutes: 60, endsAt: new Date(2026, 10, day, 11).toISOString(),
    status: 'done', quick: false, reward: { xp: 30, gold: 15, stat: 'STR', statPoints: 2 }, settledAt: new Date(2026, 10, day, 11).toISOString(),
  });
  const gym = await questByMinutes(120);
  (globalThis as { gymId?: string }).gymId = gym.id;
  await db.runs.bulkPut([prior(7), prior(8)]);
  const run = await accept(gym.id);
  const res = (await settleRun(run.id, 'done'))!;
  expect(res.milestoneGold).toBe(20);
  const p = (await db.profile.get('me'))!;
  expect(p.claimedMilestones).toEqual([3]);
  expect(p.gold).toBe(30 + 20);
  const again = (await settleRun((await accept(gym.id)).id, 'done'))!;
  expect(again.milestoneGold).toBe(0);
});

test('abandonRun only affects active runs and earns nothing', async () => {
  const run = await accept((await questByMinutes(60)).id);
  await abandonRun(run.id);
  expect((await db.runs.get(run.id))!.status).toBe('abandoned');
  expect(await getActiveRun()).toBeNull();
  expect(await settleRun(run.id, 'done')).toBeNull();
  expect((await db.profile.get('me'))!.totalXp).toBe(0);
});

test('removeQuest archives when referenced (Review Focus 2)', async () => {
  const gym = await questByMinutes(120);
  const study = await questByMinutes(60);
  const hw = await questByMinutes(90);
  const slot = (await saveSlot({ weekdays: [1], time: '19:00', questIds: [gym.id, study.id, hw.id] })) as { id: string };
  const run = await accept(gym.id);
  expect(await removeQuest(gym.id)).toBe('archived');
  expect((await db.quests.get(gym.id))!.archived).toBe(true);
  expect((await candidatesFor(slot.id)).map((q) => q.id)).toEqual([study.id, hw.id]);
  expect((await db.slots.get(slot.id))!.questIds).toEqual([study.id, hw.id]);
  expect((await getActiveRun())!.id).toBe(run.id);
  expect((await guildSummary())!.activeQuest!.name).toBe('健身');
});

test('removeQuest deletes when unreferenced', async () => {
  const proj = (await db.quests.toArray()).find((q) => q.stat === 'SKL')!;
  expect(await removeQuest(proj.id)).toBe('deleted');
  expect(await db.quests.get(proj.id)).toBeUndefined();
});

test('saveQuest validates and edits in place', async () => {
  expect(await saveQuest({ name: ' ', stat: 'STR', minutes: 30, icon: '💪' })).toEqual({ ok: false, error: 'name' });
  expect(await saveQuest({ name: '跑步', stat: 'STR', minutes: 481, icon: '🏃' })).toEqual({ ok: false, error: 'minutes' });
  const created = (await saveQuest({ name: '跑步', stat: 'STR', minutes: 30, icon: '🏃' })) as { ok: true; id: string };
  await saveQuest({ id: created.id, name: '晨跑', stat: 'STR', minutes: 45, icon: '🏃' });
  expect(await db.quests.get(created.id)).toMatchObject({ name: '晨跑', minutes: 45, archived: false });
});

test('saveSlot surfaces validation errors and removeSlot deletes', async () => {
  const gym = await questByMinutes(120);
  expect(await saveSlot({ weekdays: [1], time: '19:00', questIds: [gym.id] })).toEqual({ ok: false, error: 'candidates' });
  expect(await saveSlot({ weekdays: [1], time: '19:00', questIds: [gym.id, 'ghost'] })).toEqual({ ok: false, error: 'candidates' });
  const ok = (await saveSlot({ weekdays: [1], time: '19:00', questIds: [gym.id, (await questByMinutes(60)).id] })) as { id: string };
  await removeSlot(ok.id);
  expect(await db.slots.count()).toBe(0);
});

test('buyItem and equip', async () => {
  expect(await buyItem('hat_leaf')).toBe('gold');
  await db.profile.update('me', { gold: 100 });
  expect(await buyItem('hat_leaf')).toBe('ok');
  expect(await buyItem('hat_leaf')).toBe('owned');
  const p = (await db.profile.get('me'))!;
  expect(p.gold).toBe(60);
  expect(p.owned).toContain('hat_leaf');
  await equip('hat', 'hat_leaf');
  await equip('cape', 'cape_traveler'); // not owned → ignored
  expect((await db.profile.get('me'))!.equipped).toMatchObject({ hat: 'hat_leaf', cape: null });
  await expect(buyItem('nope')).rejects.toThrow('unknown item');
});

test('rest token purchase respects the cap', async () => {
  await db.profile.update('me', { gold: 1000 });
  expect(await buyItem('rest_token')).toBe('ok'); // starts with 2 → 3
  expect(await buyItem('rest_token')).toBe('token_cap');
  expect((await db.profile.get('me'))!.tokenPurchases).toHaveLength(1);
});

test('guildSummary reports level, rank, streak and open occurrence', async () => {
  const gym = await questByMinutes(120);
  await saveSlot({ weekdays: [1], time: '19:00', questIds: [gym.id, (await questByMinutes(60)).id] });
  setNow(2026, 11, 9, 19, 5);
  const s = (await guildSummary())!;
  expect(s).toMatchObject({ level: 1, rank: 'F', stage: 'baby', activeRun: null });
  expect(s.streak.tokens).toBe(2);
  expect(s.openOcc?.date).toBe('2026-11-09');
  expect(s.today).toHaveLength(1);
});

test('#5 the quest loop never waits on the push network', async () => {
  const hang = () => new Promise<void>(() => {});
  vi.spyOn(pushClient, 'scheduleConfirm').mockImplementation(hang);
  vi.spyOn(pushClient, 'cancelConfirm').mockImplementation(hang);
  vi.spyOn(pushClient, 'syncSlots').mockImplementation(hang);
  const within = <T,>(p: Promise<T>) =>
    Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('waited on push')), 300))]);
  const gym = await questByMinutes(120);
  const res = await within(acceptQuest({ questId: gym.id, slotId: null, date: null }));
  if (!res.ok) throw new Error(res.reason);
  await within(settleRun(res.run.id, 'done'));
  await within(saveSlot({ weekdays: [1], time: '19:00', questIds: [gym.id, (await questByMinutes(60)).id] }));
  vi.restoreAllMocks();
});
