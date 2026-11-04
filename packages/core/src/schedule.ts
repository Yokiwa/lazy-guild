import {
  QUEST_MINUTES_MAX, QUEST_MINUTES_MIN, QUICK_WINDOW_MINUTES, SLOT_CANDIDATES_MAX, SLOT_CANDIDATES_MIN,
  SLOTS_PER_DAY_MAX,
} from './balance';
import { addDays, localDate, startOfLocalDate, weekdayOf } from './dates';
import type { Quest, Slot } from './types';

export interface Occurrence {
  slotId: string;
  date: string;
  start: Date;
  end: Date;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function at(date: string, time: string): Date {
  const [h, m] = time.split(':').map(Number) as [number, number];
  const d = startOfLocalDate(date);
  d.setHours(h, m, 0, 0);
  return d;
}

/** All occurrences on a local date, sorted; each stays open until the next one or midnight. */
export function occurrencesOn(slots: Slot[], date: string): Occurrence[] {
  if (!DATE_RE.test(date)) return [];
  const weekday = weekdayOf(date);
  const midnight = startOfLocalDate(addDays(date, 1));
  const starts = slots
    .filter((s) => s.weekdays.includes(weekday) && TIME_RE.test(s.time))
    .map((s) => ({ slotId: s.id, date, start: at(date, s.time) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  return starts.map((o, i) => ({ ...o, end: starts[i + 1]?.start ?? midnight }));
}

export function openOccurrence(slots: Slot[], now: Date): Occurrence | null {
  const t = now.getTime();
  const today = occurrencesOn(slots, localDate(now));
  return today.find((o) => o.start.getTime() <= t && t < o.end.getTime()) ?? null;
}

export function findOccurrence(slots: Slot[], slotId: string, date: string): Occurrence | null {
  return occurrencesOn(slots, date).find((o) => o.slotId === slotId) ?? null;
}

export function isQuick(occ: Occurrence | null, acceptedAt: Date): boolean {
  if (!occ) return false;
  const diff = acceptedAt.getTime() - occ.start.getTime();
  return diff >= 0 && diff <= QUICK_WINDOW_MINUTES * 60_000;
}

export type SlotError = 'candidates' | 'weekdays' | 'time' | 'per_day' | 'duplicate';

export function validateSlot(slot: Slot, others: Slot[]): SlotError | null {
  const ids = slot.questIds;
  if (ids.length < SLOT_CANDIDATES_MIN || ids.length > SLOT_CANDIDATES_MAX || new Set(ids).size !== ids.length)
    return 'candidates';
  if (slot.weekdays.length === 0 || slot.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6))
    return 'weekdays';
  if (!TIME_RE.test(slot.time)) return 'time';
  const rest = others.filter((o) => o.id !== slot.id);
  for (const day of slot.weekdays) {
    const sameDay = rest.filter((o) => o.weekdays.includes(day));
    if (sameDay.some((o) => o.time === slot.time)) return 'duplicate';
    if (sameDay.length + 1 > SLOTS_PER_DAY_MAX) return 'per_day';
  }
  return null;
}

export function validateQuest(q: Pick<Quest, 'name' | 'minutes'>): 'name' | 'minutes' | null {
  const name = q.name.trim();
  if (name.length < 1 || [...name].length > 40) return 'name';
  if (!Number.isInteger(q.minutes) || q.minutes < QUEST_MINUTES_MIN || q.minutes > QUEST_MINUTES_MAX)
    return 'minutes';
  return null;
}

