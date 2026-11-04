import {
  type BadgeId, type BuyCheck, type Equipped, type Lang, type Occurrence, type Outcome, type Profile, type ProgressDelta,
  type Quest, type Rank, type Reward, type Run, type ShopItem, type Species, type Stage, type StreakState,
  SHOP_ITEMS, checkBuy, computeReward, computeStreak, earnedBadges, findOccurrence, isQuick, levelInfo, localDate,
  newlyUnlocked, occurrencesOn, openOccurrence, pendingMilestones, progressDelta, rankForLevel, stageForRank,
} from '@lazy-guild/core';
import { db } from '../db';
import { now } from '../lib/clock';
import { newId } from '../lib/id';
import { pushClient } from '../push/client';

const SEED: Record<Lang, { name: string; stat: Quest['stat']; minutes: number; icon: string }[]> = {
  zh: [
    { name: '健身', stat: 'STR', minutes: 120, icon: '💪' },
    { name: '学习一小时', stat: 'INT', minutes: 60, icon: '📚' },
    { name: '写作业', stat: 'INT', minutes: 90, icon: '✏️' },
    { name: '推进项目', stat: 'SKL', minutes: 60, icon: '🛠️' },
  ],
  en: [
    { name: 'Workout', stat: 'STR', minutes: 120, icon: '💪' },
    { name: 'Study 1h', stat: 'INT', minutes: 60, icon: '📚' },
    { name: 'Homework', stat: 'INT', minutes: 90, icon: '✏️' },
    { name: 'Side project', stat: 'SKL', minutes: 60, icon: '🛠️' },
  ],
};

export async function createProfile(name: string, species: Species, lang: Lang): Promise<void> {
  const profile: Profile = {
    id: 'me', name: name.trim(), species, createdAt: now().toISOString(), totalXp: 0, gold: 0,
    stats: { STR: 0, INT: 0, SKL: 0 }, owned: [], equipped: { hat: null, cape: null, background: null, title: null },
    badges: [], claimedMilestones: [], tokenPurchases: [], lastBackupAt: null,
  };
  await db.transaction('rw', [db.profile, db.quests], async () => {
    await db.profile.put(profile);
    if ((await db.quests.count()) === 0)
      await db.quests.bulkPut(SEED[lang].map((q) => ({ ...q, id: newId(), archived: false })));
  });
}

export async function getActiveRun(): Promise<Run | null> {
  return (await db.runs.where('status').equals('active').first()) ?? null;
}

export type AcceptResult = { ok: true; run: Run } | { ok: false; reason: 'active_exists' | 'quest_missing' };

export async function acceptQuest(input: {
  questId: string;
  slotId: string | null;
  date: string | null;
  replaceActive?: boolean;
}): Promise<AcceptResult> {
  let replaced: string | null = null;
  const result = await db.transaction('rw', [db.runs, db.quests, db.slots], async (): Promise<AcceptResult> => {
    const quest = await db.quests.get(input.questId);
    if (!quest || quest.archived) return { ok: false, reason: 'quest_missing' };
    const active = await db.runs.where('status').equals('active').first();
    if (active && !input.replaceActive) return { ok: false, reason: 'active_exists' };
    const t = now();
    if (active) {
      await db.runs.update(active.id, { status: 'abandoned', settledAt: t.toISOString() });
      replaced = active.id;
    }
    const occ =
      input.slotId && input.date ? findOccurrence(await db.slots.toArray(), input.slotId, input.date) : null;
    const run: Run = {
      id: newId(), questId: quest.id, slotId: occ ? occ.slotId : null, occurrenceDate: occ ? occ.date : null,
      startedAt: t.toISOString(), plannedMinutes: quest.minutes,
      endsAt: new Date(t.getTime() + quest.minutes * 60_000).toISOString(), status: 'active', quick: isQuick(occ, t),
      reward: null, settledAt: null,
    };
    await db.runs.add(run);
    return { ok: true, run };
  });
  if (replaced) await pushClient.cancelConfirm(replaced);
  if (result.ok) await pushClient.scheduleConfirm(result.run);
  return result;
}

export interface SettleResult {
  reward: Reward;
  delta: ProgressDelta;
  newBadges: BadgeId[];
  milestoneGold: number;
  unlocked: ShopItem[];
}

/** Idempotent: only an active run can be settled, inside one transaction. */
export async function settleRun(runId: string, outcome: Outcome): Promise<SettleResult | null> {
  const result = await db.transaction('rw', [db.runs, db.profile, db.quests], async () => {
    const run = await db.runs.get(runId);
    const profile = await db.profile.get('me');
    if (!run || run.status !== 'active' || !profile) return null;
    const quest = await db.quests.get(run.questId);
    const t = now();
    const reward = computeReward({
      plannedMinutes: run.plannedMinutes, stat: quest?.stat ?? 'SKL', outcome, quick: run.quick,
    });
    await db.runs.update(run.id, { status: outcome, reward, settledAt: t.toISOString() });

    const stats = { ...profile.stats, [reward.stat]: profile.stats[reward.stat] + reward.statPoints };
    const runs = await db.runs.toArray();
    const streak = computeStreak({ runs, createdAt: profile.createdAt, tokenPurchases: profile.tokenPurchases, now: t });
    const milestones = pendingMilestones(streak.best, profile.claimedMilestones);
    const milestoneGold = milestones.reduce((s, m) => s + m.gold, 0);
    const totalXp = profile.totalXp + reward.xp;
    const delta = progressDelta(profile.totalXp, totalXp);
    const earned = earnedBadges({
      runs, quests: await db.quests.toArray(), stats, streakBest: streak.best, restDays: streak.restDays,
      rank: delta.rankAfter, now: t,
    });
    const newBadges = earned.filter((b) => !profile.badges.includes(b));
    await db.profile.update('me', {
      totalXp, gold: profile.gold + reward.gold + milestoneGold, stats,
      badges: [...profile.badges, ...newBadges],
      claimedMilestones: [...profile.claimedMilestones, ...milestones.map((m) => m.days)],
    });
    return { reward, delta, newBadges, milestoneGold, unlocked: newlyUnlocked(delta.rankBefore, delta.rankAfter) };
  });
  if (result) await pushClient.cancelConfirm(runId);
  return result;
}

export async function abandonRun(runId: string): Promise<void> {
  const changed = await db.transaction('rw', db.runs, async () => {
    const run = await db.runs.get(runId);
    if (!run || run.status !== 'active') return false;
    await db.runs.update(runId, { status: 'abandoned', settledAt: now().toISOString() });
    return true;
  });
  if (changed) await pushClient.cancelConfirm(runId);
}

export function currentStreak(profile: Profile, runs: Run[]): StreakState {
  return computeStreak({ runs, createdAt: profile.createdAt, tokenPurchases: profile.tokenPurchases, now: now() });
}

export async function buyItem(itemId: string): Promise<BuyCheck> {
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) throw new Error('unknown item');
  return db.transaction('rw', [db.profile, db.runs], async () => {
    const profile = (await db.profile.get('me'))!;
    const tokens = currentStreak(profile, await db.runs.toArray()).tokens;
    const rank = rankForLevel(levelInfo(profile.totalXp).level);
    const check = checkBuy(item, { gold: profile.gold, rank, owned: profile.owned, tokens });
    if (check !== 'ok') return check;
    await db.profile.update('me', {
      gold: profile.gold - item.price,
      ...(item.kind === 'rest_token'
        ? { tokenPurchases: [...profile.tokenPurchases, now().toISOString()] }
        : { owned: [...profile.owned, item.id] }),
    });
    return check;
  });
}

export async function equip(slot: keyof Equipped, itemId: string | null): Promise<void> {
  await db.transaction('rw', db.profile, async () => {
    const profile = (await db.profile.get('me'))!;
    if (itemId !== null && !profile.owned.includes(itemId)) return;
    await db.profile.update('me', { equipped: { ...profile.equipped, [slot]: itemId } });
  });
}

export interface GuildSummary {
  profile: Profile;
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  rank: Rank;
  stage: Stage;
  streak: StreakState;
  activeRun: Run | null;
  activeQuest: Quest | null;
  openOcc: Occurrence | null;
  today: Occurrence[];
}

export async function guildSummary(): Promise<GuildSummary | null> {
  return db.transaction('r', [db.profile, db.runs, db.slots, db.quests], async () => {
    const profile = await db.profile.get('me');
    if (!profile) return null;
    const [runs, slots] = await Promise.all([db.runs.toArray(), db.slots.toArray()]);
    const info = levelInfo(profile.totalXp);
    const rank = rankForLevel(info.level);
    const activeRun = runs.find((r) => r.status === 'active') ?? null;
    const t = now();
    return {
      profile, ...info, rank, stage: stageForRank(rank), streak: currentStreak(profile, runs), activeRun,
      activeQuest: activeRun ? ((await db.quests.get(activeRun.questId)) ?? null) : null,
      openOcc: openOccurrence(slots, t), today: occurrencesOn(slots, localDate(t)),
    };
  });
}
