import { earnedBadges } from '../src/badges';
import { makeRun, sample } from './fixtures';

const now = new Date(2026, 10, 9, 20, 0);
const base = {
  runs: [], quests: sample.quests, stats: { STR: 0, INT: 0, SKL: 0 }, streakBest: 0, restDays: [], rank: 'F' as const, now,
};

test('nothing earned on an empty log', () => expect(earnedBadges(base)).toEqual([]));
test('first_done and quick_10', () => {
  const runs = Array.from({ length: 10 }, () => makeRun('2026-11-09', 'done', { quick: true }));
  const b = earnedBadges({ ...base, runs });
  expect(b).toEqual(expect.arrayContaining(['first_done', 'quick_10']));
  expect(b).not.toContain('first_partial');
});
test('quick skipped runs do not count toward quick_10', () => {
  const runs = Array.from({ length: 10 }, () => makeRun('2026-11-09', 'skipped', { quick: true }));
  expect(earnedBadges({ ...base, runs })).not.toContain('quick_10');
});
test('three types within 7 days', () => {
  const runs = [
    makeRun('2026-11-03', 'done', { stat: 'STR' }),
    makeRun('2026-11-05', 'partial', { stat: 'INT' }),
    makeRun('2026-11-09', 'done', { stat: 'SKL' }),
  ];
  expect(earnedBadges({ ...base, runs })).toContain('three_types_week');
  runs[0] = makeRun('2026-11-02', 'done', { stat: 'STR' }); // 8 days ago
  expect(earnedBadges({ ...base, runs })).not.toContain('three_types_week');
});
test('stat, streak, rest and rank badges', () => {
  const b = earnedBadges({
    ...base, stats: { STR: 50, INT: 49, SKL: 0 }, rank: 'C', streakBest: 14, restDays: ['2026-11-03'],
  });
  expect(b).toEqual(expect.arrayContaining(['str_50', 'rank_c', 'streak_3', 'streak_7', 'streak_14', 'first_rest']));
  expect(b).not.toContain('int_50');
  expect(b).not.toContain('rank_s');
  expect(b).not.toContain('streak_30');
  expect(earnedBadges({ ...base, rank: 'S' })).toEqual(expect.arrayContaining(['rank_c', 'rank_s']));
});
