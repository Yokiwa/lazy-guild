import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Run } from '@lazy-guild/core';
import { TestApp } from '../../src/App';
import { db, resetDb } from '../../src/db';
import i18n, { initI18n } from '../../src/i18n';
import { createProfile } from '../../src/services/guild';
import { saveQuest, saveSlot } from '../../src/services/plan';
import { setNow } from '../helpers';

beforeAll(() => initI18n('zh'));
beforeEach(async () => {
  await resetDb();
  await i18n.changeLanguage('zh');
  setNow(2026, 11, 9, 12, 0);
  await createProfile('Ray', 'slime', 'zh');
});
afterEach(() => vi.useRealTimers());

const quest = async (name: string) => (await db.quests.toArray()).find((q) => q.name === name)!;

test('plan form limits candidates to 3 and saves a slot', async () => {
  await saveQuest({ name: '跑步', stat: 'STR', minutes: 30, icon: '🏃' });
  const user = userEvent.setup();
  render(<TestApp path="/plan?new=1" />);
  const form = await screen.findByRole('form', { name: '时段' });
  await user.click(within(form).getByRole('button', { name: '周一' }));
  await user.clear(within(form).getByLabelText('时间'));
  await user.type(within(form).getByLabelText('时间'), '19:00');
  for (const n of ['健身', '学习一小时', '写作业']) await user.click(within(form).getByRole('checkbox', { name: n }));
  expect(within(form).getByRole('checkbox', { name: '跑步' })).toBeDisabled();
  await user.click(within(form).getByRole('button', { name: '保存' }));
  await waitFor(async () => expect(await db.slots.count()).toBe(1));
  expect((await db.slots.toArray())[0]).toMatchObject({ weekdays: [1], time: '19:00' });
});

test('plan form shows per_day error', async () => {
  const ids = [(await quest('健身')).id, (await quest('写作业')).id];
  for (let h = 0; h < 6; h++) await saveSlot({ weekdays: [1], time: `0${h}:00`, questIds: ids });
  const user = userEvent.setup();
  render(<TestApp path="/plan?new=1" />);
  const form = await screen.findByRole('form', { name: '时段' });
  await user.click(within(form).getByRole('button', { name: '周一' }));
  await user.clear(within(form).getByLabelText('时间'));
  await user.type(within(form).getByLabelText('时间'), '20:00');
  await user.click(within(form).getByRole('checkbox', { name: '健身' }));
  await user.click(within(form).getByRole('checkbox', { name: '写作业' }));
  await user.click(within(form).getByRole('button', { name: '保存' }));
  expect(await within(form).findByText('这一天已经有 6 个时段了')).toBeInTheDocument();
});

test('plan flags slots that lost candidates', async () => {
  await db.slots.put({ id: 's1', weekdays: [2], time: '08:00', questIds: [(await quest('健身')).id] });
  render(<TestApp path="/plan" />);
  expect(await screen.findByText('需要补候选')).toBeInTheDocument();
});

test('quest form rejects 481 minutes with message', async () => {
  const user = userEvent.setup();
  render(<TestApp path="/quests" />);
  await user.click(await screen.findByRole('button', { name: '添加委托' }));
  const form = screen.getByRole('form', { name: '委托' });
  await user.type(within(form).getByLabelText('名称'), '冥想');
  await user.clear(within(form).getByLabelText('时长（分钟）'));
  await user.type(within(form).getByLabelText('时长（分钟）'), '481');
  await user.click(within(form).getByRole('button', { name: '保存' }));
  expect(await within(form).findByText('时长要在 5–480 分钟之间')).toBeInTheDocument();
  expect(await db.quests.count()).toBe(4);
});

test('quest delete archives a referenced quest', async () => {
  const ids = [(await quest('健身')).id, (await quest('写作业')).id];
  await saveSlot({ weekdays: [1], time: '19:00', questIds: ids });
  const user = userEvent.setup();
  render(<TestApp path="/quests" />);
  await user.click(await screen.findByRole('button', { name: '编辑 健身' }));
  await user.click(screen.getByRole('button', { name: '删除' }));
  expect(await screen.findByText('“健身”已归档：它还在冒险日志或时段里用到。')).toBeInTheDocument();
  expect((await quest('健身')).archived).toBe(true);
});

test('log lists only done and partial', async () => {
  const id = (await quest('健身')).id;
  const mk = (status: Run['status'], n: number): Run => ({
    id: `r${n}`, questId: id, slotId: null, occurrenceDate: null, startedAt: new Date(2026, 10, 9, 8 + n).toISOString(),
    plannedMinutes: 120, endsAt: new Date(2026, 10, 9, 10 + n).toISOString(), status, quick: false,
    reward: { xp: 60, gold: 30, stat: 'STR', statPoints: 4 }, settledAt: new Date(2026, 10, 9, 10 + n).toISOString(),
  });
  await db.runs.bulkPut([mk('done', 0), mk('partial', 1), mk('skipped', 2), mk('abandoned', 3)]);
  render(<TestApp path="/profile" />);
  const log = await screen.findByRole('list', { name: '冒险日志' });
  await waitFor(() => expect(within(log).getAllByRole('listitem')).toHaveLength(2));
});

test('shop shows rank lock and gold shortage, then buys and equips', async () => {
  const user = userEvent.setup();
  render(<TestApp path="/shop" />);
  const crown = await screen.findByRole('article', { name: '王冠' });
  expect(within(crown).getByText('需要 A 阶')).toBeInTheDocument();
  const leaf = screen.getByRole('article', { name: '小树叶' });
  expect(within(leaf).getByRole('button', { name: /购买/ })).toBeDisabled();
  expect(within(leaf).getByText('金币不够')).toBeInTheDocument();
  await db.profile.update('me', { gold: 100 });
  const buy = within(leaf).getByRole('button', { name: /购买/ });
  await waitFor(() => expect(buy).toBeEnabled());
  await user.click(buy);
  await user.click(await within(leaf).findByRole('button', { name: '装备' }));
  await waitFor(async () => expect((await db.profile.get('me'))!.equipped.hat).toBe('hat_leaf'));
});

test('language switch updates UI', async () => {
  const user = userEvent.setup();
  render(<TestApp path="/settings" />);
  await user.click(await screen.findByRole('button', { name: 'English' }));
  expect(await screen.findByText('Hall')).toBeInTheDocument();
  expect(await db.kv.get('lang')).toEqual({ key: 'lang', value: 'en' });
});
