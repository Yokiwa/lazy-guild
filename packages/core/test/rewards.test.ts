import { computeReward } from '../src/rewards';
import type { Outcome } from '../src/types';

const r = (plannedMinutes: number, outcome: Outcome, quick = false) =>
  computeReward({ plannedMinutes, stat: 'STR', outcome, quick });

test('2h done', () => expect(r(120, 'done')).toEqual({ xp: 60, gold: 30, stat: 'STR', statPoints: 4 }));
test('2h partial halves', () => expect(r(120, 'partial')).toEqual({ xp: 30, gold: 15, stat: 'STR', statPoints: 2 }));
test('caps at 180 min', () => expect(r(240, 'done')).toEqual({ xp: 90, gold: 45, stat: 'STR', statPoints: 6 }));
test('5 min done uses minimums', () => expect(r(5, 'done')).toEqual({ xp: 10, gold: 5, stat: 'STR', statPoints: 1 }));
test('5 min partial', () => expect(r(5, 'partial')).toEqual({ xp: 5, gold: 2, stat: 'STR', statPoints: 0 }));
test('quick bonus on 1h', () => expect(r(60, 'done', true)).toEqual({ xp: 36, gold: 18, stat: 'STR', statPoints: 2 }));
test('quick bonus stacks after partial halving', () =>
  expect(r(120, 'partial', true)).toEqual({ xp: 36, gold: 18, stat: 'STR', statPoints: 2 }));
test('skipped gives nothing even if quick', () =>
  expect(r(60, 'skipped', true)).toEqual({ xp: 0, gold: 0, stat: 'STR', statPoints: 0 }));
test('stat is carried through', () =>
  expect(computeReward({ plannedMinutes: 60, stat: 'INT', outcome: 'done', quick: false }).stat).toBe('INT'));
