import { computeStreak, pendingMilestones } from '../src/streak';
import type { Run, RunStatus } from '../src/types';

// TZ is America/New_York (vitest.config.ts). 2026-11-02 is a Monday.
let n = 0;
function runOn(date: string, status: RunStatus, time = '10:00'): Run {
  const startedAt = new Date(`${date}T${time}:00`).toISOString();
  return {
    id: `r${n++}`, questId: 'q', slotId: null, occurrenceDate: null, startedAt, plannedMinutes: 60,
    endsAt: startedAt, status, quick: false, reward: null, settledAt: null,
  };
}
const at = (s: string) => new Date(s);
const created = '2026-11-02T08:00:00-05:00'; // Monday

test('consecutive adventure days count', () => {
  const s = computeStreak({
    runs: [runOn('2026-11-02', 'done'), runOn('2026-11-03', 'partial'), runOn('2026-11-04', 'done')],
    createdAt: created, tokenPurchases: [], now: at('2026-11-04T20:00:00-05:00'),
  });
  expect(s).toMatchObject({ current: 3, best: 3, tokens: 2, restDays: [] });
});

test('empty past day uses a token and keeps streak', () => {
  const s = computeStreak({
    runs: [runOn('2026-11-02', 'done'), runOn('2026-11-04', 'done')],
    createdAt: created, tokenPurchases: [], now: at('2026-11-04T20:00:00-05:00'),
  });
  expect(s).toMatchObject({ current: 2, best: 2, tokens: 1, restDays: ['2026-11-03'] });
});

test('streak resets when no tokens left', () => {
  // Mon done; Tue, Wed use the 2 tokens; Thu has none → reset. Viewed Friday morning.
  const s = computeStreak({
    runs: [runOn('2026-11-02', 'done')], createdAt: created, tokenPurchases: [],
    now: at('2026-11-06T09:00:00-05:00'),
  });
  expect(s).toMatchObject({ current: 0, best: 1, tokens: 0, restDays: ['2026-11-03', '2026-11-04'] });
});

test('today not yet done does not break streak', () => {
  const s = computeStreak({
    runs: [runOn('2026-11-02', 'done'), runOn('2026-11-03', 'done')], createdAt: created, tokenPurchases: [],
    now: at('2026-11-04T09:00:00-05:00'),
  });
  expect(s).toMatchObject({ current: 2, restDays: [] });
});

test('skipped and abandoned runs do not count', () => {
  const s = computeStreak({
    runs: [runOn('2026-11-02', 'skipped'), runOn('2026-11-02', 'abandoned'), runOn('2026-11-02', 'active')],
    createdAt: created, tokenPurchases: [], now: at('2026-11-02T20:00:00-05:00'),
  });
  expect(s).toMatchObject({ current: 0, best: 0 });
});

test('late confirmation counts on start day', () => {
  const late = { ...runOn('2026-11-03', 'done', '23:30'), settledAt: '2026-11-04T15:00:00.000Z' };
  const s = computeStreak({
    runs: [runOn('2026-11-02', 'done'), late, runOn('2026-11-04', 'done')], createdAt: created, tokenPurchases: [],
    now: at('2026-11-04T20:00:00-05:00'),
  });
  expect(s).toMatchObject({ current: 3, restDays: [] });
});

test('monday grant respects cap of 3', () => {
  const runs: Run[] = [];
  for (let d = 2; d <= 15; d++) runs.push(runOn(`2026-11-${String(d).padStart(2, '0')}`, 'done'));
  const s = computeStreak({ runs, createdAt: created, tokenPurchases: [], now: at('2026-11-15T20:00:00-05:00') });
  expect(s).toMatchObject({ current: 14, tokens: 3 });
});

test('creation on a non-Monday still grants starting tokens once', () => {
  const s = computeStreak({
    runs: [runOn('2026-11-04', 'done')], createdAt: '2026-11-04T08:00:00-05:00', tokenPurchases: [],
    now: at('2026-11-04T20:00:00-05:00'),
  });
  expect(s.tokens).toBe(2);
});

test('purchased token is added on purchase day', () => {
  // Mon done; Tue, Wed use both tokens; buy one Thu morning; Thu empty → uses it; Fri done.
  const s = computeStreak({
    runs: [runOn('2026-11-02', 'done'), runOn('2026-11-06', 'done')], createdAt: created,
    tokenPurchases: ['2026-11-05T08:00:00-05:00'], now: at('2026-11-06T20:00:00-05:00'),
  });
  expect(s).toMatchObject({ current: 2, tokens: 0, restDays: ['2026-11-03', '2026-11-04', '2026-11-05'] });
});

test('DST fall-back day is counted exactly once', () => {
  // 2026-11-01 (Sunday) has 25 hours in America/New_York
  const s = computeStreak({
    runs: [runOn('2026-10-31', 'done'), runOn('2026-11-01', 'done'), runOn('2026-11-02', 'done')],
    createdAt: '2026-10-31T08:00:00-04:00', tokenPurchases: [], now: at('2026-11-02T20:00:00-05:00'),
  });
  expect(s).toMatchObject({ current: 3, restDays: [] });
});

test('pendingMilestones', () => {
  expect(pendingMilestones(8, [3])).toEqual([{ days: 7, gold: 50 }]);
  expect(pendingMilestones(2, [])).toEqual([]);
  expect(pendingMilestones(30, [3, 7, 14, 30])).toEqual([]);
});
