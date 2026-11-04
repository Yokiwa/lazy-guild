import { RANK_MIN_LEVEL, MILESTONES, TOKEN_CAP, WEEKLY_TOKENS } from '../src/balance';

test('rank thresholds match spec', () => {
  expect(RANK_MIN_LEVEL).toEqual({ F: 1, E: 5, D: 10, C: 15, B: 25, A: 35, S: 50 });
});
test('milestones are ascending and match spec', () => {
  expect(MILESTONES.map((m) => [m.days, m.gold])).toEqual([
    [3, 20],
    [7, 50],
    [14, 100],
    [30, 200],
    [100, 500],
  ]);
});
test('token rules', () => {
  expect([WEEKLY_TOKENS, TOKEN_CAP]).toEqual([2, 3]);
});
