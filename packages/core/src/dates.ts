/** Device-local calendar helpers. All dates are "YYYY-MM-DD" in the device time zone. */

export function localDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local midnight at the start of the given local date. */
export function startOfLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

/** Add whole calendar days (DST-safe: never adds 24h blindly). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return localDate(new Date(y, m - 1, d + days));
}

export function weekdayOf(date: string): number {
  return startOfLocalDate(date).getDay();
}
