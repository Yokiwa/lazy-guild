import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestApp } from '../../src/App';
import { db, resetDb } from '../../src/db';
import { initI18n } from '../../src/i18n';
import { acceptQuest, createProfile } from '../../src/services/guild';
import { saveSlot } from '../../src/services/plan';
import { setNow } from '../helpers';

beforeAll(() => initI18n('zh'));
beforeEach(async () => {
  await resetDb();
  setNow(2026, 11, 9, 18, 0); // Monday
});
afterEach(() => vi.useRealTimers());

const quest = async (name: string) => (await db.quests.toArray()).find((q) => q.name === name)!;

test('onboarding creates the adventurer and opens the plan', async () => {
  const user = userEvent.setup();
  render(<TestApp path="/" />);
  await user.type(await screen.findByLabelText('冒险者名字'), 'Ray');
  await user.click(screen.getByRole('button', { name: '下一步' }));
  await user.click(screen.getByRole('button', { name: /史莱姆/ }));
  await user.click(screen.getByRole('button', { name: '下一步' }));
  await user.click(screen.getByRole('button', { name: '先跳过' }));
  await waitFor(async () => expect(await db.profile.get('me')).toMatchObject({ name: 'Ray', species: 'slime' }));
  expect(await db.quests.count()).toBe(4);
  expect(await screen.findByRole('form', { name: '时段' })).toBeInTheDocument();
});

test('visiting onboarding with an existing profile goes to the hall', async () => {
  await createProfile('Ray', 'slime', 'zh');
  render(<TestApp path="/onboarding" />);
  expect(await screen.findByText('Lv 1')).toBeInTheDocument();
});

test('onboarding rejects an empty name', async () => {
  const user = userEvent.setup();
  render(<TestApp path="/onboarding" />);
  await user.click(await screen.findByRole('button', { name: '下一步' }));
  expect(screen.getByText('名字要 1–20 个字')).toBeInTheDocument();
});

test('hall shows level, streak and today’s slot', async () => {
  await createProfile('Ray', 'slime', 'zh');
  await saveSlot({ weekdays: [1], time: '19:00', questIds: [(await quest('健身')).id, (await quest('学习一小时')).id] });
  render(<TestApp path="/" />);
  expect(await screen.findByText('Lv 1')).toBeInTheDocument();
  expect(screen.getByText('F 阶冒险者')).toBeInTheDocument();
  expect(screen.getByText('19:00')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '现在就接个委托' })).toBeInTheDocument();
});

test('choose from slot link → run → confirm done shows reward', async () => {
  await createProfile('Ray', 'slime', 'zh');
  const slot = (await saveSlot({
    weekdays: [1], time: '19:00', questIds: [(await quest('健身')).id, (await quest('学习一小时')).id],
  })) as { id: string };
  setNow(2026, 11, 9, 19, 5);
  const user = userEvent.setup();
  render(<TestApp path={`/choose?slot=${slot.id}&date=2026-11-09`} />);
  expect(await screen.findByText('15 分钟内接取，经验和金币 +20%')).toBeInTheDocument();
  await user.click(await screen.findByRole('button', { name: /健身/ }));
  await user.click(await screen.findByRole('button', { name: '提前完成' }));
  await user.click(await screen.findByRole('button', { name: '完成' }));
  expect(await screen.findByText('+72')).toBeInTheDocument();
  expect((await db.profile.get('me'))!.totalXp).toBe(72);
});

test('expired occurrence offers free quest', async () => {
  await createProfile('Ray', 'slime', 'zh');
  const slot = (await saveSlot({
    weekdays: [1], time: '19:00', questIds: [(await quest('健身')).id, (await quest('学习一小时')).id],
  })) as { id: string };
  setNow(2026, 11, 10, 9, 0); // next day
  render(<TestApp path={`/choose?slot=${slot.id}&date=2026-11-09`} />);
  expect(await screen.findByText('这个委托已经过期了')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '接个自由委托' })).toBeInTheDocument();
});

test('overdue active run redirects hall to confirm (Review Focus 3)', async () => {
  await createProfile('Ray', 'slime', 'zh');
  const res = await acceptQuest({ questId: (await quest('健身')).id, slotId: null, date: null });
  if (!res.ok) throw new Error(res.reason);
  setNow(2026, 11, 11, 20, 0); // two days later
  const user = userEvent.setup();
  render(<TestApp path="/" />);
  expect(await screen.findByText('委托完成了吗？')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '完成' }));
  expect(await screen.findByText('+60')).toBeInTheDocument();
  const run = (await db.runs.get(res.run.id))!;
  expect(run.status).toBe('done');
  expect(new Date(run.startedAt).getDate()).toBe(9);
});

test('active run conflict dialog', async () => {
  await createProfile('Ray', 'slime', 'zh');
  await acceptQuest({ questId: (await quest('写作业')).id, slotId: null, date: null });
  const user = userEvent.setup();
  render(<TestApp path="/choose" />);
  await user.click(await screen.findByRole('button', { name: /健身/ }));
  expect(await screen.findByText('你还有一个委托在进行中')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '放弃当前的，接新的' }));
  await waitFor(async () => expect((await db.runs.where('status').equals('active').first())!.questId).toBe((await quest('健身')).id));
});

test('already settled run shows a notice', async () => {
  await createProfile('Ray', 'slime', 'zh');
  const res = await acceptQuest({ questId: (await quest('健身')).id, slotId: null, date: null });
  if (!res.ok) throw new Error(res.reason);
  await db.runs.update(res.run.id, { status: 'done' });
  render(<TestApp path={`/confirm?run=${res.run.id}`} />);
  expect(await screen.findByText('这个委托已经结算过了')).toBeInTheDocument();
});
