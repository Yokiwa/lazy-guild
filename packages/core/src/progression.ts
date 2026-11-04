import { LEVEL_BASE_XP, LEVEL_STEP_XP, MAX_LEVEL, RANK_MIN_LEVEL } from './balance';
import type { Rank, Stage } from './types';

const RANKS_DESC: Rank[] = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];

export function xpToNext(level: number): number {
  if (level >= MAX_LEVEL) return Infinity;
  return LEVEL_BASE_XP + LEVEL_STEP_XP * (level - 1);
}

/** Level is derived from total xp; only totalXp is stored. */
export function levelInfo(totalXp: number): { level: number; xpIntoLevel: number; xpForNext: number } {
  let level = 1;
  let remaining = Math.max(0, totalXp);
  while (level < MAX_LEVEL && remaining >= xpToNext(level)) {
    remaining -= xpToNext(level);
    level++;
  }
  if (level >= MAX_LEVEL) return { level: MAX_LEVEL, xpIntoLevel: 0, xpForNext: Infinity };
  return { level, xpIntoLevel: remaining, xpForNext: xpToNext(level) };
}

export function rankForLevel(level: number): Rank {
  return RANKS_DESC.find((r) => level >= RANK_MIN_LEVEL[r]) ?? 'F';
}

export function stageForRank(rank: Rank): Stage {
  if (rank === 'F' || rank === 'E') return 'baby';
  if (rank === 'A' || rank === 'S') return 'adult';
  return 'teen';
}

export interface ProgressDelta {
  levelBefore: number;
  levelAfter: number;
  rankBefore: Rank;
  rankAfter: Rank;
  stageBefore: Stage;
  stageAfter: Stage;
}

export function progressDelta(beforeXp: number, afterXp: number): ProgressDelta {
  const levelBefore = levelInfo(beforeXp).level;
  const levelAfter = levelInfo(afterXp).level;
  const rankBefore = rankForLevel(levelBefore);
  const rankAfter = rankForLevel(levelAfter);
  return {
    levelBefore,
    levelAfter,
    rankBefore,
    rankAfter,
    stageBefore: stageForRank(rankBefore),
    stageAfter: stageForRank(rankAfter),
  };
}
