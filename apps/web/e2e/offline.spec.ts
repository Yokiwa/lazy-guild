import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('offline: app loads and a quest can be accepted without network', async ({ page, context }) => {
  await onboard(page);
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // now controlled by the service worker
  await expect(page.getByText('Lv 1')).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Lv 1')).toBeVisible();
  await page.getByRole('link', { name: '现在就接个委托' }).click();
  await page.getByRole('button', { name: /推进项目/ }).click();
  await expect(page).toHaveURL(/\/run/);
  await page.goto('/profile'); // deep link served from cache
  await expect(page.getByRole('heading', { name: '冒险者档案' })).toBeVisible();
});
