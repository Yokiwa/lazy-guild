export type Stat = 'STR' | 'INT' | 'SKL';
export type Outcome = 'done' | 'partial' | 'skipped';
export type RunStatus = 'active' | Outcome | 'abandoned';
export type Species = 'slime' | 'foxfire' | 'drake';
export type Rank = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
export type Stage = 'baby' | 'teen' | 'adult';
export type Lang = 'zh' | 'en';

export interface Stats {
  STR: number;
  INT: number;
  SKL: number;
}

export interface Quest {
  id: string;
  name: string;
  stat: Stat;
  minutes: number;
  icon: string;
  archived: boolean;
}

/** weekdays: 0 = Sunday … 6 = Saturday; time: "HH:mm" in device local time */
export interface Slot {
  id: string;
  weekdays: number[];
  time: string;
  questIds: string[];
}

export interface Reward {
  xp: number;
  gold: number;
  stat: Stat;
  statPoints: number;
}

export interface Run {
  id: string;
  questId: string;
  slotId: string | null;
  /** local YYYY-MM-DD of the slot occurrence this run was accepted from */
  occurrenceDate: string | null;
  startedAt: string;
  plannedMinutes: number;
  endsAt: string;
  status: RunStatus;
  quick: boolean;
  reward: Reward | null;
  settledAt: string | null;
}

export interface Equipped {
  hat: string | null;
  cape: string | null;
  background: string | null;
  title: string | null;
}

export interface Profile {
  id: 'me';
  name: string;
  species: Species;
  createdAt: string;
  totalXp: number;
  gold: number;
  stats: Stats;
  owned: string[];
  equipped: Equipped;
  badges: string[];
  claimedMilestones: number[];
  /** ISO timestamps of rest-token purchases */
  tokenPurchases: string[];
  lastBackupAt: string | null;
}

export interface GuildData {
  profile: Profile;
  quests: Quest[];
  slots: Slot[];
  runs: Run[];
}
