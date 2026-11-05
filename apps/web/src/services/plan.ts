import { type Quest, type Slot, type SlotError, validateQuest, validateSlot } from '@lazy-guild/core';
import { db } from '../db';
import { newId } from '../lib/id';
import { inBackground, pushClient } from '../push/client';

export async function saveQuest(
  q: Omit<Quest, 'id' | 'archived'> & { id?: string },
): Promise<{ ok: true; id: string } | { ok: false; error: 'name' | 'minutes' }> {
  const error = validateQuest(q);
  if (error) return { ok: false, error };
  const id = q.id ?? newId();
  await db.quests.put({ id, name: q.name.trim(), stat: q.stat, minutes: q.minutes, icon: q.icon, archived: false });
  return { ok: true, id };
}

/** Quests referenced by any run or slot are archived (never deleted) so logs keep their names. */
export async function removeQuest(id: string): Promise<'deleted' | 'archived'> {
  return db.transaction('rw', [db.quests, db.runs, db.slots], async () => {
    const slots = await db.slots.toArray();
    const inSlots = slots.filter((s) => s.questIds.includes(id));
    const inRuns = (await db.runs.filter((r) => r.questId === id).count()) > 0;
    for (const s of inSlots) await db.slots.update(s.id, { questIds: s.questIds.filter((x) => x !== id) });
    if (inRuns || inSlots.length > 0) {
      await db.quests.update(id, { archived: true });
      return 'archived';
    }
    await db.quests.delete(id);
    return 'deleted';
  });
}

export async function saveSlot(
  s: Omit<Slot, 'id'> & { id?: string },
): Promise<{ ok: true; id: string } | { ok: false; error: SlotError }> {
  const slot: Slot = { id: s.id ?? newId(), weekdays: [...new Set(s.weekdays)].sort(), time: s.time, questIds: s.questIds };
  const result = await db.transaction('rw', [db.slots, db.quests], async () => {
    const quests = await db.quests.bulkGet(slot.questIds);
    if (quests.some((q) => !q || q.archived)) return { ok: false as const, error: 'candidates' as const };
    const error = validateSlot(slot, await db.slots.toArray());
    if (error) return { ok: false as const, error };
    await db.slots.put(slot);
    return { ok: true as const, id: slot.id };
  });
  if (result.ok) inBackground(pushClient.syncSlots());
  return result;
}

export async function removeSlot(id: string): Promise<void> {
  await db.slots.delete(id);
  inBackground(pushClient.syncSlots());
}

export async function candidatesFor(slotId: string): Promise<Quest[]> {
  const slot = await db.slots.get(slotId);
  if (!slot) return [];
  const quests = await db.quests.bulkGet(slot.questIds);
  return quests.filter((q): q is Quest => !!q && !q.archived);
}
