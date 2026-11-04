import type { Rank } from './types';

// Every game number lives here. Tune the game by editing this file only.

export const XP_PER_HOUR = 30;
export const XP_MIN = 10;
export const XP_MIN_PARTIAL = 5;
export const REWARD_MINUTES_CAP = 180;
export const STAT_MINUTES_PER_POINT = 30;
export const QUICK_WINDOW_MINUTES = 15;
export const QUICK_MULTIPLIER = 1.2;

export const MAX_LEVEL = 50;
export const LEVEL_BASE_XP = 100;
export const LEVEL_STEP_XP = 20;
export const RANK_MIN_LEVEL: Record<Rank, number> = { F: 1, E: 5, D: 10, C: 15, B: 25, A: 35, S: 50 };

export const WEEKLY_TOKENS = 2;
export const TOKEN_CAP = 3;
export const TOKEN_PRICE = 60;
export const MILESTONES: { days: number; gold: number }[] = [
  { days: 3, gold: 20 },
  { days: 7, gold: 50 },
  { days: 14, gold: 100 },
  { days: 30, gold: 200 },
  { days: 100, gold: 500 },
];

export const QUEST_MINUTES_MIN = 5;
export const QUEST_MINUTES_MAX = 480;
export const SLOT_CANDIDATES_MIN = 2;
export const SLOT_CANDIDATES_MAX = 3;
export const SLOTS_PER_DAY_MAX = 6;
export const BACKUP_REMINDER_DAYS = 30;
