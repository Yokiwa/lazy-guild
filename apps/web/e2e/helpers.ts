import { expect, type Page } from '@playwright/test';

export const MONDAY_1855 = new Date('2026-11-09T18:55:00-05:00');

export async function onboard(page: Page, name = 'Ray') {
  await page.goto('/');
  await page.getByLabel('冒险者名字').fill(name);
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByRole('button', { name: /史莱姆/ }).click();
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByRole('button', { name: '先跳过' }).click();
  await expect(page.getByRole('form', { name: '时段' })).toBeVisible();
}

/** Creates a Monday 19:00 slot with 健身 / 学习一小时 from the open plan form. */
export async function addMondaySlot(page: Page) {
  const form = page.getByRole('form', { name: '时段' });
  await form.getByRole('button', { name: '周一' }).click();
  await form.getByLabel('时间').fill('19:00');
  await form.getByRole('checkbox', { name: '健身' }).check();
  await form.getByRole('checkbox', { name: '学习一小时' }).check();
  await form.getByRole('button', { name: '保存' }).click();
  await expect(form).toBeHidden();
}
