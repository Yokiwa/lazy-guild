import { addDays, localDate } from './dates';
import type { Quest, Rank, Run, Stat, Stats } from './types';

export const BADGE_IDS = [
  'first_done', 'first_partial', 'str_50', 'int_50', 'skl_50', 'streak_3', 'streak_7', 'streak_14', 'streak_30',
  'streak_100', 'three_types_week', 'first_rest', 'rank_c', 'rank_s', 'quick_10',
] as const;
export type BadgeId = (typeof BADGE_IDS)[number];

const RANK_ORDER: Rank[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
const STREAKS = [3, 7, 14, 30, 100] as const;

export interface BadgeContext {
  runs: Run[];
  quests: Quest[];
  stats: Stats;
  streakBest: number;
  restDays: string[];
  rank: Rank;
  now: Date;
}

/** Every badge whose condition currently holds; diff against profile.badges for new ones. */
export function earnedBadges(ctx: BadgeContext): BadgeId[] {
  const completed = ctx.runs.filter((r) => r.status === 'done' || r.status === 'partial');
  const out: BadgeId[] = [];
  if (completed.some((r) => r.status === 'done')) out.push('first_done');
  if (completed.some((r) => r.status === 'partial')) out.push('first_partial');
  if (ctx.stats.STR >= 50) out.push('str_50');
  if (ctx.stats.INT >= 50) out.push('int_50');
  if (ctx.stats.SKL >= 50) out.push('skl_50');
  for (const n of STREAKS) if (ctx.streakBest >= n) out.push(`streak_${n}`);

  const today = localDate(ctx.now);
  const weekStart = addDays(today, -6);
  const questStat = new Map(ctx.quests.map((q) => [q.id, q.stat]));
  const stats = new Set<Stat>();
  for (const r of completed) {
    const day = localDate(new Date(r.startedAt));
    const stat = r.reward?.stat ?? questStat.get(r.questId);
    if (day >= weekStart && day <= today && stat) stats.add(stat);
  }
  if (stats.size >= 3) out.push('three_types_week');

  if (ctx.restDays.length > 0) out.push('first_rest');
  const rankIdx = RANK_ORDER.indexOf(ctx.rank);
  if (rankIdx >= RANK_ORDER.indexOf('C')) out.push('rank_c');
  if (ctx.rank === 'S') out.push('rank_s');
  if (completed.filter((r) => r.quick).length >= 10) out.push('quick_10');
  return out;
}
