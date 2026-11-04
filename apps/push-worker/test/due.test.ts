import { dueSlotKeys, localParts } from '../src/due';

const NY = 'America/New_York';
const mon19 = [{ slot_id: 'a', weekday: 1, hhmm: '19:00' }];

test('localParts in device tz', () => {
  expect(localParts(new Date('2026-11-10T00:00:30Z'), NY)).toEqual({ date: '2026-11-09', weekday: 1, hhmm: '19:00' });
  expect(localParts(new Date('2026-11-10T00:00:30Z'), 'Asia/Shanghai')).toEqual({ date: '2026-11-10', weekday: 2, hhmm: '08:00' });
});
test('matches local time in device tz', () => {
  // 2026-11-09 19:00 America/New_York = 2026-11-10T00:00Z
  expect(dueSlotKeys(mon19, NY, new Date('2026-11-10T00:00:30Z'))).toEqual([
    { slotId: 'a', date: '2026-11-09', key: 'a@2026-11-09' },
  ]);
  expect(dueSlotKeys(mon19, NY, new Date('2026-11-09T23:59:59Z'))).toEqual([]);
});
test('lookback catches a late cron (Review Focus 1)', () => {
  expect(dueSlotKeys(mon19, NY, new Date('2026-11-10T00:04:10Z'))).toHaveLength(1);
  expect(dueSlotKeys(mon19, NY, new Date('2026-11-10T00:05:10Z'))).toHaveLength(0);
});
test('DST spring-forward skipped time never matches', () => {
  // 2027-03-14 (Sunday) 02:30 does not exist in America/New_York
  const rows = [{ slot_id: 'a', weekday: 0, hhmm: '02:30' }];
  for (let m = 0; m < 180; m++)
    expect(dueSlotKeys(rows, NY, new Date(Date.parse('2027-03-14T05:00:00Z') + m * 60000))).toHaveLength(0);
});
test('DST fall-back repeated time yields same key', () => {
  // 2026-11-01 (Sunday) 01:30 happens at 05:30Z (EDT) and again at 06:30Z (EST)
  const rows = [{ slot_id: 'a', weekday: 0, hhmm: '01:30' }];
  const first = dueSlotKeys(rows, NY, new Date('2026-11-01T05:30:00Z'));
  const second = dueSlotKeys(rows, NY, new Date('2026-11-01T06:30:00Z'));
  expect(first).toEqual([{ slotId: 'a', date: '2026-11-01', key: 'a@2026-11-01' }]);
  expect(second).toEqual(first);
});
test('one key per slot even when lookback minutes repeat it', () => {
  expect(dueSlotKeys(mon19, NY, new Date('2026-11-10T00:02:00Z'))).toHaveLength(1);
});
