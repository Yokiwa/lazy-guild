import { vi } from 'vitest';

/** Freeze Date only (Dexie and React still get real timers). Month is 1-based here. */
export function setNow(y: number, mo: number, d: number, h = 12, mi = 0, s = 0) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(y, mo - 1, d, h, mi, s));
}
