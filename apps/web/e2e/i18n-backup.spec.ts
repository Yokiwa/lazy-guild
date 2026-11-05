import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('language switch', async ({ page }) => {
  await onboard(page);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('link', { name: /Hall/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});

test('backup export then import restores data', async ({ page }) => {
  await onboard(page);
  await page.goto('/settings');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '导出备份' }).click()]);
  const path = await download.path();
  expect(JSON.parse(await readFile(path, 'utf8'))).toMatchObject({ app: 'lazy-guild', version: 1 });

  await page.goto('/quests');
  await page.getByRole('button', { name: '编辑 健身' }).click();
  await page.getByLabel('名称').fill('举铁');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('举铁')).toBeVisible();

  await page.goto('/settings');
  page.on('dialog', (d) => d.accept());
  const pre = page.waitForEvent('download');
  await page.getByText('导入备份').setInputFiles(path);
  expect((await pre).suggestedFilename()).toMatch(/^lazy-guild-before-import-/);
  await expect(page.getByText('导入成功！')).toBeVisible();
  await page.goto('/quests');
  await expect(page.getByText('健身')).toBeVisible();
  await expect(page.getByText('举铁')).toBeHidden();
});

test('a broken backup is rejected with a reason', async ({ page }) => {
  await onboard(page);
  await page.goto('/settings');
  page.on('dialog', (d) => d.accept());
  await page.getByText('导入备份').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"foo":1}') });
  await expect(page.getByText('这不是懒人公会的备份')).toBeVisible();
});

test('no horizontal scroll on every page', async ({ page }) => {
  await onboard(page);
  for (const path of ['/', '/choose', '/run', '/confirm', '/plan', '/quests', '/profile', '/shop', '/settings']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(fits, path).toBe(true);
  }
});
