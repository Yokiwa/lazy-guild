import Dexie, { type EntityTable } from 'dexie';
import type { GuildData, Profile, Quest, Run, Slot } from '@lazy-guild/core';

export interface KV {
  key: string;
  value: unknown;
}

export class GuildDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  quests!: EntityTable<Quest, 'id'>;
  slots!: EntityTable<Slot, 'id'>;
  runs!: EntityTable<Run, 'id'>;
  kv!: EntityTable<KV, 'key'>;

  constructor() {
    super('lazy-guild');
    this.version(1).stores({
      profile: 'id',
      quests: 'id',
      slots: 'id',
      runs: 'id, status, startedAt',
      kv: 'key',
    });
  }
}

export const db = new GuildDB();

export async function resetDb(): Promise<void> {
  await db.transaction('rw', [db.profile, db.quests, db.slots, db.runs, db.kv], async () => {
    await Promise.all([db.profile.clear(), db.quests.clear(), db.slots.clear(), db.runs.clear(), db.kv.clear()]);
  });
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await db.kv.get(key))?.value as T | undefined;
}
export async function kvSet(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value });
}

export async function loadGuildData(): Promise<GuildData | null> {
  return db.transaction('r', [db.profile, db.quests, db.slots, db.runs], async () => {
    const profile = await db.profile.get('me');
    if (!profile) return null;
    const [quests, slots, runs] = await Promise.all([db.quests.toArray(), db.slots.toArray(), db.runs.toArray()]);
    return { profile, quests, slots, runs };
  });
}

export async function replaceGuildData(d: GuildData): Promise<void> {
  await db.transaction('rw', [db.profile, db.quests, db.slots, db.runs], async () => {
    await Promise.all([db.profile.clear(), db.quests.clear(), db.slots.clear(), db.runs.clear()]);
    await db.profile.put(d.profile);
    await db.quests.bulkPut(d.quests);
    await db.slots.bulkPut(d.slots);
    await db.runs.bulkPut(d.runs);
  });
}
