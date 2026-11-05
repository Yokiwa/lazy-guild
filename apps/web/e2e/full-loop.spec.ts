import { expect, test } from '@playwright/test';
import { MONDAY_1855, addMondaySlot, onboard } from './helpers';

test('full loop: onboarding → slot → choose → confirm', async ({ page }) => {
  await page.clock.install({ time: MONDAY_1855 });
  await onboard(page);
  await addMondaySlot(page);
  await expect(page.getByRole('button', { name: /19:00/ })).toBeVisible();

  await page.clock.fastForward('05:00');
  // what tapping the 19:00 notification opens
  const slotLink = await page.evaluate(async () => {
    const req = indexedDB.open('lazy-guild');
    const db: IDBDatabase = await new Promise((r) => (req.onsuccess = () => r(req.result)));
    const slots: { id: string }[] = await new Promise((r) => {
      const g = db.transaction('slots').objectStore('slots').getAll();
      g.onsuccess = () => r(g.result);
    });
    return `/choose?slot=${slots[0]!.id}&date=2026-11-09`;
  });
  await page.goto(slotLink);
  await expect(page.getByText('15 分钟内接取，经验和金币 +20%')).toBeVisible();
  await page.getByRole('button', { name: /健身/ }).click();
  await expect(page).toHaveURL(/\/run/);
  await expect(page.locator('.countdown')).toBeVisible();

  await page.clock.fastForward('02:00:00');
  await page.goto('/');
  await expect(page).toHaveURL(/\/confirm/);
  await page.getByRole('button', { name: '完成' }).click();
  await expect(page.getByText('+72')).toBeVisible(); // 120 min + quick accept
  await page.getByRole('link', { name: '回到大厅' }).click();
  await expect(page.getByText('Lv 1')).toBeVisible(); // 72 < 100
  await expect(page.getByText('72 / 100 经验')).toBeVisible();
});

test('a missed slot expires quietly and a free quest still works', async ({ page }) => {
  await page.clock.install({ time: MONDAY_1855 });
  await onboard(page);
  await addMondaySlot(page);
  await page.goto('/choose?slot=missing&date=2026-11-09');
  await expect(page.getByText('这个委托已经过期了')).toBeVisible();
  await page.getByRole('link', { name: '接个自由委托' }).click();
  await page.getByRole('button', { name: /学习一小时/ }).click();
  await page.getByRole('button', { name: '提前完成' }).click();
  await page.getByRole('button', { name: '做了一部分' }).click();
  await expect(page.getByText('+15')).toBeVisible(); // 60 min partial, no quick bonus
});
