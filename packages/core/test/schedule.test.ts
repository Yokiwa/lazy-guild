import {
  findOccurrence, isQuick, occurrencesOn, openOccurrence, validateQuest, validateSlot,
} from '../src/schedule';
import type { Slot } from '../src/types';

// TZ = America/New_York; 2026-11-09 is a Monday
const mwf: Slot = { id: 'a', weekdays: [1, 3, 5], time: '19:00', questIds: ['q1', 'q2'] };
const mon21: Slot = { id: 'b', weekdays: [1], time: '21:00', questIds: ['q1', 'q3'] };

test('occurrence window ends at next slot', () => {
  const [o1, o2] = occurrencesOn([mon21, mwf], '2026-11-09');
  expect(o1!.slotId).toBe('a');
  expect(o1!.start.getTime()).toBe(new Date(2026, 10, 9, 19, 0).getTime());
  expect(o1!.end.getTime()).toBe(o2!.start.getTime());
  expect(o2!.end.getTime()).toBe(new Date(2026, 10, 10).getTime());
});
test('no occurrences on days outside weekdays', () => {
  expect(occurrencesOn([mwf], '2026-11-10')).toEqual([]);
});
test('open occurrence', () => {
  expect(openOccurrence([mwf], new Date(2026, 10, 9, 18, 59))).toBeNull();
  expect(openOccurrence([mwf], new Date(2026, 10, 9, 19, 0))?.slotId).toBe('a');
  expect(openOccurrence([mwf, mon21], new Date(2026, 10, 9, 21, 30))?.slotId).toBe('b');
  expect(openOccurrence([mwf], new Date(2026, 10, 10, 0, 0))).toBeNull();
});
test('quick window is 15 minutes inclusive', () => {
  const o = findOccurrence([mwf], 'a', '2026-11-09')!;
  expect(isQuick(o, new Date(2026, 10, 9, 19, 15))).toBe(true);
  expect(isQuick(o, new Date(2026, 10, 9, 19, 15, 1))).toBe(false);
  expect(isQuick(o, new Date(2026, 10, 9, 18, 59))).toBe(false);
  expect(isQuick(null, new Date())).toBe(false);
});
test('findOccurrence rejects wrong weekday or missing slot', () => {
  expect(findOccurrence([mwf], 'a', '2026-11-10')).toBeNull();
  expect(findOccurrence([mwf], 'zzz', '2026-11-09')).toBeNull();
  expect(findOccurrence([mwf], 'a', 'garbage')).toBeNull();
});
test('validateSlot', () => {
  expect(validateSlot({ ...mwf, questIds: ['q1'] }, [])).toBe('candidates');
  expect(validateSlot({ ...mwf, questIds: ['q1', 'q2', 'q3', 'q4'] }, [])).toBe('candidates');
  expect(validateSlot({ ...mwf, questIds: ['q1', 'q1'] }, [])).toBe('candidates');
  expect(validateSlot({ ...mwf, weekdays: [] }, [])).toBe('weekdays');
  expect(validateSlot({ ...mwf, weekdays: [7] }, [])).toBe('weekdays');
  expect(validateSlot({ ...mwf, time: '24:00' }, [])).toBe('time');
  expect(validateSlot({ ...mwf, time: '7:00' }, [])).toBe('time');
  expect(validateSlot({ ...mwf, id: 'c' }, [mwf])).toBe('duplicate');
  const six = Array.from({ length: 6 }, (_, i) => ({ ...mwf, id: `s${i}`, time: `0${i}:00` }));
  expect(validateSlot({ ...mwf, id: 'x', time: '20:00' }, six)).toBe('per_day');
  expect(validateSlot(mwf, [mwf])).toBeNull();
});
test('validateQuest', () => {
  expect(validateQuest({ name: '  ', minutes: 30 })).toBe('name');
  expect(validateQuest({ name: 'x'.repeat(41), minutes: 30 })).toBe('name');
  expect(validateQuest({ name: '健身', minutes: 4 })).toBe('minutes');
  expect(validateQuest({ name: '健身', minutes: 481 })).toBe('minutes');
  expect(validateQuest({ name: '健身', minutes: 30.5 })).toBe('minutes');
  expect(validateQuest({ name: '健身', minutes: 120 })).toBeNull();
});
