import {
  QUICK_MULTIPLIER,
  REWARD_MINUTES_CAP,
  STAT_MINUTES_PER_POINT,
  XP_MIN,
  XP_MIN_PARTIAL,
  XP_PER_HOUR,
} from './balance';
import type { Outcome, Reward, Stat } from './types';

export interface RewardInput {
  plannedMinutes: number;
  stat: Stat;
  outcome: Outcome;
  quick: boolean;
}

/**
 * Reward for settling one run. Order: base → partial halving → quick bonus.
 * Rewards always use planned minutes (finishing early never costs anything).
 */
export function computeReward({ plannedMinutes, stat, outcome, quick }: RewardInput): Reward {
  if (outcome === 'skipped') return { xp: 0, gold: 0, stat, statPoints: 0 };

  const minutes = Math.min(plannedMinutes, REWARD_MINUTES_CAP);
  let xp = Math.max(XP_MIN, Math.round((minutes / 60) * XP_PER_HOUR));
  let gold = Math.floor(xp / 2);
  let statPoints = Math.max(1, Math.floor(minutes / STAT_MINUTES_PER_POINT));

  if (outcome === 'partial') {
    xp = Math.max(XP_MIN_PARTIAL, Math.floor(xp / 2));
    gold = Math.floor(gold / 2);
    statPoints = Math.floor(statPoints / 2);
  }

  if (quick) {
    xp = Math.floor(xp * QUICK_MULTIPLIER);
    gold = Math.floor(gold * QUICK_MULTIPLIER);
  }

  return { xp, gold, stat, statPoints };
}
