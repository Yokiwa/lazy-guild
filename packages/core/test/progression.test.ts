import { levelInfo, progressDelta, rankForLevel, stageForRank, xpToNext } from '../src/progression';
import type { Rank } from '../src/types';

test('xp curve', () => {
  expect(xpToNext(1)).toBe(100);
  expect(xpToNext(2)).toBe(120);
  expect(xpToNext(50)).toBe(Infinity);
});
test('levelInfo boundaries', () => {
  expect(levelInfo(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNext: 100 });
  expect(levelInfo(99).level).toBe(1);
  expect(levelInfo(100)).toEqual({ level: 2, xpIntoLevel: 0, xpForNext: 120 });
  expect(levelInfo(220).level).toBe(3);
});
test('total xp to reach S is 28420 and caps there', () => {
  expect(levelInfo(28419).level).toBe(49);
  expect(levelInfo(28420).level).toBe(50);
  expect(levelInfo(999999)).toEqual({ level: 50, xpIntoLevel: 0, xpForNext: Infinity });
});
test.each([
  [1, 'F'], [4, 'F'], [5, 'E'], [10, 'D'], [14, 'D'], [15, 'C'], [25, 'B'], [34, 'B'], [35, 'A'], [49, 'A'], [50, 'S'],
] as [number, Rank][])('level %i → %s', (l, r) => expect(rankForLevel(l)).toBe(r));
test('stages', () => {
  expect(stageForRank('E')).toBe('baby');
  expect(stageForRank('D')).toBe('teen');
  expect(stageForRank('B')).toBe('teen');
  expect(stageForRank('A')).toBe('adult');
  expect(stageForRank('S')).toBe('adult');
});
test('multi-level jump reported', () => {
  expect(progressDelta(90, 400)).toMatchObject({ levelBefore: 1, levelAfter: 4, rankBefore: 'F', rankAfter: 'F' });
});
test('stage change reported across D threshold', () => {
  // level 10 needs sum_{L=1..9}(100+20(L-1)) = 900 + 720 = 1620 xp
  expect(progressDelta(1600, 1620)).toMatchObject({ rankBefore: 'E', rankAfter: 'D', stageBefore: 'baby', stageAfter: 'teen' });
});
