import { MILESTONES, TOKEN_CAP, WEEKLY_TOKENS } from './balance';
import { addDays, localDate, weekdayOf } from './dates';
import type { Run } from './types';

export interface StreakInput {
  runs: Run[];
  createdAt: string;
  tokenPurchases: string[];
  now: Date;
}

export interface StreakState {
  current: number;
  best: number;
  tokens: number;
  /** past local dates that consumed a rest token */
  restDays: string[];
}

/**
 * Pure replay of the adventure log: recomputed from scratch every time, so a
 * run confirmed a day late still lands on the day it started.
 */
export function computeStreak({ runs, createdAt, tokenPurchases, now }: StreakInput): StreakState {
  const adventureDays = new Set(
    runs.filter((r) => r.status === 'done' || r.status === 'partial').map((r) => localDate(new Date(r.startedAt))),
  );
  const purchasesByDay = new Map<string, number>();
  for (const p of tokenPurchases) {
    const day = localDate(new Date(p));
    purchasesByDay.set(day, (purchasesByDay.get(day) ?? 0) + 1);
  }

  const first = localDate(new Date(createdAt));
  const today = localDate(now);
  let tokens = 0;
  let current = 0;
  let best = 0;
  const restDays: string[] = [];

  for (let day = first; day <= today; day = addDays(day, 1)) {
    if (day === first || weekdayOf(day) === 1) tokens = Math.min(TOKEN_CAP, tokens + WEEKLY_TOKENS);
    tokens = Math.min(TOKEN_CAP, tokens + (purchasesByDay.get(day) ?? 0));

    if (adventureDays.has(day)) {
      current++;
      best = Math.max(best, current);
    } else if (day < today) {
      if (tokens > 0) {
        tokens--;
        restDays.push(day);
      } else {
        current = 0;
      }
    }
  }
  return { current, best, tokens, restDays };
}

export function pendingMilestones(best: number, claimed: number[]): { days: number; gold: number }[] {
  return MILESTONES.filter((m) => best >= m.days && !claimed.includes(m.days));
}
