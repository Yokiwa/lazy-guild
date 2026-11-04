export const LOOKBACK_MINUTES = 5;

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      hourCycle: 'h23', weekday: 'short',
    });
    formatters.set(tz, f);
  }
  return f;
}

export function localParts(at: Date, tz: string): { date: string; weekday: number; hhmm: string } {
  const p = Object.fromEntries(formatter(tz).formatToParts(at).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, weekday: WEEKDAYS[p.weekday!]!, hhmm: `${p.hour}:${p.minute}` };
}

export interface SlotRow {
  slot_id: string;
  weekday: number;
  hhmm: string;
}

/**
 * Slots whose local time matches now or one of the previous LOOKBACK_MINUTES-1 minutes
 * (Cloudflare cron can run late). Skipped DST times never match; repeated DST times map
 * to the same key, and sent_log dedupes by key.
 */
export function dueSlotKeys(rows: SlotRow[], tz: string, now: Date): { slotId: string; date: string; key: string }[] {
  const out = new Map<string, { slotId: string; date: string; key: string }>();
  for (let k = 0; k < LOOKBACK_MINUTES; k++) {
    const parts = localParts(new Date(now.getTime() - k * 60_000), tz);
    for (const r of rows) {
      if (r.weekday === parts.weekday && r.hhmm === parts.hhmm) {
        const key = `${r.slot_id}@${parts.date}`;
        out.set(key, { slotId: r.slot_id, date: parts.date, key });
      }
    }
  }
  return [...out.values()];
}
