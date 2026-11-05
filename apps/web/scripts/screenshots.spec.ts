import { test, type Page } from '@playwright/test';

const OUT = '../../docs/screenshots';
const NOW = new Date('2026-11-09T19:02:00-05:00'); // Monday, just after a 19:00 slot

const QUESTS = {
  zh: [['健身', 'STR', 120, '💪'], ['学习一小时', 'INT', 60, '📚'], ['写作业', 'INT', 90, '✏️'], ['学日语', 'INT', 30, '🎌'], ['推进项目', 'SKL', 60, '🛠️']],
  en: [['Workout', 'STR', 120, '💪'], ['Study 1h', 'INT', 60, '📚'], ['Homework', 'INT', 90, '✏️'], ['Japanese', 'INT', 30, '🎌'], ['Side project', 'SKL', 60, '🛠️']],
} as const;

/** Writes a believable two-week-old save straight into IndexedDB. */
async function seed(page: Page, lang: 'zh' | 'en') {
  await page.goto('/onboarding'); // lets the app create its schema
  await page.waitForLoadState('networkidle');
  await page.evaluate(
    async ({ lang, quests, now }) => {
      const day = (offset: number, h: number) => {
        const d = new Date(now);
        d.setDate(d.getDate() + offset);
        d.setHours(h, 0, 0, 0);
        return d.toISOString();
      };
      const qs = quests.map(([name, stat, minutes, icon], i) => ({ id: `q${i}`, name, stat, minutes, icon, archived: false }));
      const runs = [];
      for (let o = -12; o <= -1; o++) {
        const q = qs[(o + 12) % qs.length]!;
        const partial = o % 4 === 0;
        runs.push({
          id: `r${o}`, questId: q.id, slotId: null, occurrenceDate: null, startedAt: day(o, 19), plannedMinutes: q.minutes,
          endsAt: day(o, 21), status: partial ? 'partial' : 'done', quick: o % 2 === 0,
          reward: { xp: partial ? 15 : 30, gold: partial ? 7 : 15, stat: q.stat, statPoints: partial ? 1 : 2 }, settledAt: day(o, 21),
        });
      }
      const profile = {
        id: 'me', name: lang === 'zh' ? '雷蒙' : 'Ray', species: 'foxfire', createdAt: day(-12, 9), totalXp: 1700, gold: 236,
        stats: { STR: 22, INT: 41, SKL: 15 }, owned: ['hat_leaf', 'cape_traveler', 'bg_forest', 'title_early_bird'],
        equipped: { hat: 'hat_leaf', cape: 'cape_traveler', background: 'bg_forest', title: 'title_early_bird' },
        badges: ['first_done', 'first_partial', 'streak_3', 'streak_7', 'three_types_week', 'quick_10'],
        claimedMilestones: [3, 7], tokenPurchases: [], lastBackupAt: day(-1, 22),
      };
      const slots = [
        { id: 's1', weekdays: [1, 3, 5], time: '19:00', questIds: ['q0', 'q3', 'q2'] },
        { id: 's2', weekdays: [1, 2, 3, 4, 5], time: '21:30', questIds: ['q1', 'q4'] },
        { id: 's3', weekdays: [0, 6], time: '10:00', questIds: ['q0', 'q4'] },
      ];
      const req = indexedDB.open('lazy-guild');
      const db: IDBDatabase = await new Promise((r) => (req.onsuccess = () => r(req.result)));
      const tx = db.transaction(['profile', 'quests', 'slots', 'runs', 'kv'], 'readwrite');
      tx.objectStore('profile').put(profile);
      for (const q of qs) tx.objectStore('quests').put(q);
      for (const s of slots) tx.objectStore('slots').put(s);
      for (const r of runs) tx.objectStore('runs').put(r);
      tx.objectStore('kv').put({ key: 'lang', value: lang });
      await new Promise((r) => (tx.oncomplete = r));
      db.close();
    },
    { lang, quests: QUESTS[lang].map((q) => [...q]), now: NOW.toISOString() },
  );
}

for (const lang of ['zh', 'en'] as const) {
  test(`screenshots (${lang})`, async ({ page }) => {
    await page.clock.install({ time: NOW });
    await seed(page, lang);
    const shot = async (name: string) => {
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/${lang}-${name}.png` });
    };
    await page.goto('/');
    await shot('1-hall');
    await page.goto('/choose?slot=s1&date=2026-11-09');
    await shot('2-choose');
    await page.locator('.quest-card').first().click();
    await page.waitForURL(/\/run/);
    await page.clock.fastForward('25:00');
    await shot('3-run');
    await page.locator('button.btn.primary.big').click();
    await page.locator('button.btn.primary.big').click(); // "done"
    await page.waitForSelector('.reward');
    await shot('4-result');
    await page.goto('/profile');
    await shot('5-profile');
    await page.goto('/shop');
    await shot('6-shop');
  });
}
