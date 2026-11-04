import { makeBackup, parseBackup } from '../src/backup';
import { sample } from './fixtures';

const now = new Date('2026-11-09T12:00:00Z');

test('round trip', () => {
  expect(parseBackup(JSON.stringify(makeBackup(sample, now)))).toEqual({ ok: true, data: sample });
});
test('rejects other apps, newer versions, junk, huge files', () => {
  expect(parseBackup('{"foo":1}')).toEqual({ ok: false, error: 'wrong_app' });
  expect(parseBackup('[1,2]')).toEqual({ ok: false, error: 'wrong_app' });
  expect(parseBackup(JSON.stringify({ ...makeBackup(sample, now), version: 2 }))).toEqual({ ok: false, error: 'newer_version' });
  expect(parseBackup('not json')).toEqual({ ok: false, error: 'not_json' });
  expect(parseBackup('x'.repeat(5_000_001))).toEqual({ ok: false, error: 'too_large' });
});
test('rejects out-of-range values', () => {
  const bad = structuredClone(makeBackup(sample, now));
  bad.data.quests[0]!.minutes = 9999;
  expect(parseBackup(JSON.stringify(bad))).toEqual({ ok: false, error: 'invalid' });
  const bad2 = structuredClone(makeBackup(sample, now));
  (bad2.data.profile as { species: string }).species = 'unicorn';
  expect(parseBackup(JSON.stringify(bad2))).toEqual({ ok: false, error: 'invalid' });
  const bad3 = structuredClone(makeBackup(sample, now));
  bad3.data.slots[0]!.time = '25:00';
  expect(parseBackup(JSON.stringify(bad3))).toEqual({ ok: false, error: 'invalid' });
});
test('rejects runs pointing at unknown quests', () => {
  const bad = structuredClone(makeBackup(sample, now));
  bad.data.runs[0]!.questId = 'ghost';
  expect(parseBackup(JSON.stringify(bad))).toEqual({ ok: false, error: 'invalid' });
});
