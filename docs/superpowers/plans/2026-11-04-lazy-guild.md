# 懒人公会 / Lazy Guild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做出一个可以部署的 PWA：到点推送 → 二选一 / 三选一接委托 → 到时确认完成 → 冒险者公会 + 伙伴的游戏化成长，全部本地存储，推送由 Cloudflare Worker 负责。

**Architecture:** pnpm monorepo，三块：`packages/core`（纯 TypeScript 游戏规则和排程，无 DOM、无网络）、`apps/web`（React + Vite + vite-plugin-pwa，Dexie 存 IndexedDB，i18next 中英双语）、`apps/push-worker`（Cloudflare Worker + D1 + 每分钟 Cron，只存推送时间表）。网页端所有数值都调用 core 计算；推送服务不知道任何任务内容。

**Tech Stack:** Node 22、pnpm 10、TypeScript 5.9.3、React 19、Vite 8、@vitejs/plugin-react 5.2、vite-plugin-pwa 2（injectManifest）、Dexie 4 + dexie-react-hooks、react-router-dom 7、i18next + react-i18next、zod 4、Vitest 4.1、@testing-library/react 16、fake-indexeddb 6、@playwright/test 1.63.0、wrangler 4、@cloudflare/vitest-pool-workers 0.23、@block65/webcrypto-web-push 2、ESLint 10 + typescript-eslint 8、Prettier。

**Spec:** `docs/superpowers/specs/2026-11-04-lazy-guild-design.md`

## Global Constraints

- 包管理只用 pnpm workspace；所有包 `"type": "module"`；TypeScript `strict: true`
- TypeScript 固定 `5.9.3`（typescript-eslint 要求 `<6.1`）；Vitest 统一 `~4.1.12`（pool-workers 要求 `^4.1`）
- `@playwright/test` 固定 `1.63.0`，与容器里预装的浏览器一致；CI 里用 `pnpm exec playwright install --with-deps chromium`
- 所有界面文字都走 i18n，`zh.json` 和 `en.json` 的键必须完全一致；课程号、专有名词可以不翻译
- 委托时长 5–480 分钟；每个时段 2–3 个候选委托；每天最多 6 个时段
- 推送服务**不得**接收或存储委托名称、游戏数据；通知文字只用通用句子
- 所有游戏数值只在 `packages/core/src/balance.ts` 定义
- 不提交任何密钥：VAPID 私钥、Cloudflare token 只放 Worker secrets 和 GitHub Secrets
- 美术全部原创 SVG，不使用任何现有作品的角色或画风
- 移动优先：所有页面在 390×844（iPhone 14）下不出现横向滚动
- 许可证 MIT；开发在分支 `feat/lazy-guild-v1` 上进行，提交作者 `raymondweng <raymondweng828@gmail.com>`

## Review Focus

1. **Cron 晚跑或漏跑一分钟**（Cloudflare 不保证每分钟准点）→ 时段通知仍然发出且只发一次。Task 8 加测试：往前看 5 分钟的补发窗口。
2. **委托或时段被删，但还有场次开着、冒险在进行、日志引用它** → 选择卡不显示已删委托，进行中的冒险和日志照常显示名称。被引用的委托只归档不删除。Task 10 加测试。
3. **冒险已过结束时间很久才打开 App**（比如隔了两天）→ 首页直接跳到结算，奖励算在开始那天。Task 11 加测试。
4. **结算按钮连点两次，或者两个标签页同时结算** → 只发一次奖励。Task 10 加测试：并发调用 `settleRun`。
5. **导入别的 App 的 JSON、版本号比当前新的备份、超大文件** → 整份拒收并给出原因，现有数据不动。Task 6 加测试。

---

## 文件结构

```
lazy-guild/
├── package.json  pnpm-workspace.yaml  tsconfig.base.json  eslint.config.js  .prettierrc  .gitignore  LICENSE  README.md  README.en.md
├── .github/workflows/ci.yml  deploy.yml
├── docs/deploy.md  docs/iphone-guide.md  docs/screenshots/*.png
├── packages/core/src/
│   ├── types.ts        共享类型
│   ├── balance.ts      所有数值
│   ├── rewards.ts      单次结算奖励
│   ├── progression.ts  等级、阶级、伙伴形态
│   ├── streak.ts       连续天数、休息券、里程碑
│   ├── schedule.ts     场次推算、有效期、迅速接取、时段校验
│   ├── badges.ts       徽章判定
│   ├── shop.ts         商品目录与购买校验
│   ├── backup.ts       备份导出与校验（zod）
│   └── index.ts        统一导出
├── apps/push-worker/
│   ├── wrangler.toml  migrations/0001_init.sql
│   ├── src/index.ts     fetch + scheduled 入口
│   ├── src/routes.ts    HTTP 接口
│   ├── src/auth.ts      设备密钥
│   ├── src/validate.ts  请求体校验
│   ├── src/due.ts       按时区判断哪些时段到点
│   ├── src/dispatch.ts  每分钟的发送逻辑
│   ├── src/push.ts      PushSender 接口与真实实现
│   ├── src/messages.ts  通知文字（zh/en）
│   └── scripts/vapid.mjs 生成 VAPID 密钥
└── apps/web/src/
    ├── main.tsx  App.tsx  sw.ts
    ├── db.ts                 Dexie 数据库
    ├── lib/clock.ts  lib/id.ts
    ├── i18n/index.ts  i18n/zh.json  i18n/en.json
    ├── services/guild.ts     接取、结算、放弃、购买、开档
    ├── services/plan.ts      委托与时段的增删改
    ├── services/backup.ts    导出导入
    ├── push/client.ts        订阅、同步队列、状态
    ├── content/lines.ts      伙伴台词选择
    ├── art/                  Companion.tsx、backgrounds.tsx、cosmetics.tsx（SVG 组件）
    ├── components/           Layout、TabBar、QuestCard、RewardSummary、CompanionBubble
    └── pages/                Onboarding、Hall、Choose、Run、Confirm、Plan、Quests、Profile、Shop、Settings
```

---

### Task 1: 仓库骨架 + core 类型和数值

**Files:**
- Create: 根目录 `package.json`、`pnpm-workspace.yaml`、`tsconfig.base.json`、`eslint.config.js`、`.prettierrc`、`.gitignore`、`LICENSE`、`.github/workflows/ci.yml`
- Create: `packages/core/package.json`、`tsconfig.json`、`vitest.config.ts`、`src/types.ts`、`src/balance.ts`、`src/index.ts`
- Test: `packages/core/test/balance.test.ts`

**Interfaces:**
- Produces（`types.ts`）:
  ```ts
  export type Stat = 'STR' | 'INT' | 'SKL';
  export type Outcome = 'done' | 'partial' | 'skipped';
  export type RunStatus = 'active' | Outcome | 'abandoned';
  export type Species = 'slime' | 'foxfire' | 'drake';
  export type Rank = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
  export type Stage = 'baby' | 'teen' | 'adult';
  export type Lang = 'zh' | 'en';
  export interface Stats { STR: number; INT: number; SKL: number }
  export interface Quest { id: string; name: string; stat: Stat; minutes: number; icon: string; archived: boolean }
  export interface Slot { id: string; weekdays: number[]; time: string; questIds: string[] } // weekdays 0=周日…6=周六, time "HH:mm"
  export interface Reward { xp: number; gold: number; stat: Stat; statPoints: number }
  export interface Run {
    id: string; questId: string; slotId: string | null; occurrenceDate: string | null; // YYYY-MM-DD 本地日期
    startedAt: string; plannedMinutes: number; endsAt: string; // ISO
    status: RunStatus; quick: boolean; reward: Reward | null; settledAt: string | null;
  }
  export interface Equipped { hat: string | null; cape: string | null; background: string | null; title: string | null }
  export interface Profile {
    id: 'me'; name: string; species: Species; createdAt: string; totalXp: number; gold: number; stats: Stats;
    owned: string[]; equipped: Equipped; badges: string[]; claimedMilestones: number[];
    tokenPurchases: string[]; // 购买休息券的 ISO 时间
    lastBackupAt: string | null;
  }
  export interface GuildData { profile: Profile; quests: Quest[]; slots: Slot[]; runs: Run[] }
  ```
- Produces（`balance.ts`）: 下列常量，值照抄 spec 第 5 节：`XP_PER_HOUR = 30`、`XP_MIN = 10`、`XP_MIN_PARTIAL = 5`、`REWARD_MINUTES_CAP = 180`、`STAT_MINUTES_PER_POINT = 30`、`QUICK_WINDOW_MINUTES = 15`、`QUICK_MULTIPLIER = 1.2`、`MAX_LEVEL = 50`、`LEVEL_BASE_XP = 100`、`LEVEL_STEP_XP = 20`、`RANK_MIN_LEVEL: Record<Rank, number> = { F: 1, E: 5, D: 10, C: 15, B: 25, A: 35, S: 50 }`、`WEEKLY_TOKENS = 2`、`TOKEN_CAP = 3`、`TOKEN_PRICE = 60`、`MILESTONES: { days: number; gold: number }[] = [{3,20},{7,50},{14,100},{30,200},{100,500}]`、`QUEST_MINUTES_MIN = 5`、`QUEST_MINUTES_MAX = 480`、`SLOT_CANDIDATES_MIN = 2`、`SLOT_CANDIDATES_MAX = 3`、`SLOTS_PER_DAY_MAX = 6`、`BACKUP_REMINDER_DAYS = 30`

- [ ] **Step 1: 建分支和根配置**

`git checkout -b feat/lazy-guild-v1`。根 `package.json` 脚本：`lint`（eslint .）、`typecheck`（`pnpm -r typecheck`）、`test`（`pnpm -r test`）、`format`。`pnpm-workspace.yaml` 包含 `packages/*`、`apps/*`。`.gitignore` 包含 `node_modules`、`dist`、`.wrangler`、`playwright-report`、`test-results`、`.dev.vars`。`ci.yml`：在 push 和 PR 上运行 `pnpm install --frozen-lockfile`、`pnpm lint`、`pnpm typecheck`、`pnpm test`（Playwright 的任务在 Task 14 补上）。三个包名：`@lazy-guild/core`、`@lazy-guild/web`、`@lazy-guild/push-worker`；core 的 `package.json` 用 `"exports": { ".": "./src/index.ts" }` 直接导出 TS 源码，web 和 push-worker 用 `"@lazy-guild/core": "workspace:*"` 依赖它（Vite 和 wrangler 都能直接打包 TS）。

- [ ] **Step 2: 写失败的测试 `packages/core/test/balance.test.ts`**

```ts
import { RANK_MIN_LEVEL, MILESTONES, TOKEN_CAP, WEEKLY_TOKENS } from '../src/balance';
test('rank thresholds match spec', () => {
  expect(RANK_MIN_LEVEL).toEqual({ F: 1, E: 5, D: 10, C: 15, B: 25, A: 35, S: 50 });
});
test('milestones are ascending and match spec', () => {
  expect(MILESTONES.map((m) => [m.days, m.gold])).toEqual([[3, 20], [7, 50], [14, 100], [30, 200], [100, 500]]);
});
test('token rules', () => { expect([WEEKLY_TOKENS, TOKEN_CAP]).toEqual([2, 3]); });
```

- [ ] **Step 3: 运行，确认失败**：`pnpm --filter @lazy-guild/core test` → FAIL（找不到模块）
- [ ] **Step 4: 写 `types.ts`、`balance.ts`、`index.ts`**（index 用 `export *` 导出全部模块）
- [ ] **Step 5: 运行 `pnpm install && pnpm lint && pnpm typecheck && pnpm test`** → 全部 PASS
- [ ] **Step 6: 提交** `chore: scaffold monorepo and core balance constants`

---

### Task 2: 单次结算奖励

**Files:**
- Create: `packages/core/src/rewards.ts`
- Test: `packages/core/test/rewards.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `Stat`、`Outcome`、`Reward` 和 balance 常量
- Produces: `computeReward(input: { plannedMinutes: number; stat: Stat; outcome: Outcome; quick: boolean }): Reward`

计算顺序（spec 5.1 没写死的部分在这里定下来）：`m = min(planned, 180)` → `xp = max(10, round(m/60*30))`、`gold = floor(xp/2)`、`statPoints = max(1, floor(m/30))` → 如果是 partial：`xp = max(5, floor(xp/2))`、`gold = floor(gold/2)`、`statPoints = floor(statPoints/2)` → 如果是 quick：`xp = floor(xp*1.2)`、`gold = floor(gold*1.2)`（属性不加成）→ skipped 时全部为 0。

- [ ] **Step 1: 写失败的测试**

```ts
const r = (plannedMinutes: number, outcome: Outcome, quick = false) =>
  computeReward({ plannedMinutes, stat: 'STR', outcome, quick });
test('2h done', () => expect(r(120, 'done')).toEqual({ xp: 60, gold: 30, stat: 'STR', statPoints: 4 }));
test('2h partial halves', () => expect(r(120, 'partial')).toEqual({ xp: 30, gold: 15, stat: 'STR', statPoints: 2 }));
test('caps at 180 min', () => expect(r(240, 'done')).toEqual({ xp: 90, gold: 45, stat: 'STR', statPoints: 6 }));
test('5 min done uses minimums', () => expect(r(5, 'done')).toEqual({ xp: 10, gold: 5, stat: 'STR', statPoints: 1 }));
test('5 min partial', () => expect(r(5, 'partial')).toEqual({ xp: 5, gold: 2, stat: 'STR', statPoints: 0 }));
test('quick bonus on 1h', () => expect(r(60, 'done', true)).toEqual({ xp: 36, gold: 18, stat: 'STR', statPoints: 2 }));
test('skipped gives nothing even if quick', () => expect(r(60, 'skipped', true)).toEqual({ xp: 0, gold: 0, stat: 'STR', statPoints: 0 }));
```

- [ ] **Step 2: 运行确认失败** → FAIL（`computeReward` 不存在）
- [ ] **Step 3: 实现 `rewards.ts`**
- [ ] **Step 4: 运行确认通过** → PASS
- [ ] **Step 5: 提交** `feat(core): reward calculation`

---

### Task 3: 等级、阶级、伙伴形态

**Files:**
- Create: `packages/core/src/progression.ts`
- Test: `packages/core/test/progression.test.ts`

**Interfaces:**
- Produces:
  - `xpToNext(level: number): number` —— `100 + 20*(level-1)`；level ≥ 50 时返回 `Infinity`
  - `levelInfo(totalXp: number): { level: number; xpIntoLevel: number; xpForNext: number }` —— 只存 `totalXp`，等级由它推出
  - `rankForLevel(level: number): Rank`
  - `stageForRank(rank: Rank): Stage` —— F/E→baby，D/C/B→teen，A/S→adult
  - `progressDelta(beforeXp: number, afterXp: number): { levelBefore; levelAfter; rankBefore: Rank; rankAfter: Rank; stageBefore: Stage; stageAfter: Stage }`

- [ ] **Step 1: 写失败的测试**

```ts
test('xp curve', () => { expect(xpToNext(1)).toBe(100); expect(xpToNext(2)).toBe(120); expect(xpToNext(50)).toBe(Infinity); });
test('levelInfo boundaries', () => {
  expect(levelInfo(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNext: 100 });
  expect(levelInfo(99).level).toBe(1);
  expect(levelInfo(100)).toEqual({ level: 2, xpIntoLevel: 0, xpForNext: 120 });
  expect(levelInfo(220).level).toBe(3);
});
test('total xp to reach S is 28420 and caps there', () => {
  expect(levelInfo(28419).level).toBe(49);
  expect(levelInfo(28420).level).toBe(50);
  expect(levelInfo(999999)).toEqual({ level: 50, xpIntoLevel: 0, xpForNext: Infinity });
});
test.each([[1,'F'],[4,'F'],[5,'E'],[10,'D'],[14,'D'],[15,'C'],[25,'B'],[34,'B'],[35,'A'],[49,'A'],[50,'S']])('level %i → %s', (l, r) => expect(rankForLevel(l)).toBe(r));
test('stages', () => { expect(stageForRank('E')).toBe('baby'); expect(stageForRank('D')).toBe('teen'); expect(stageForRank('A')).toBe('adult'); });
test('multi-level jump reported', () => {
  expect(progressDelta(90, 400)).toMatchObject({ levelBefore: 1, levelAfter: 4, rankBefore: 'F', rankAfter: 'F' });
});
```

- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现 `progression.ts`**
- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5: 提交** `feat(core): levels, ranks and companion stages`

---

### Task 4: 连续天数、休息券、里程碑

**Files:**
- Create: `packages/core/src/streak.ts`
- Test: `packages/core/test/streak.test.ts`

**Interfaces:**
- Consumes: `Run`、`Profile.tokenPurchases`、balance 常量
- Produces:
  - `computeStreak(input: { runs: Run[]; createdAt: string; tokenPurchases: string[]; now: Date }): { current: number; best: number; tokens: number; restDays: string[] }`
  - `pendingMilestones(best: number, claimed: number[]): { days: number; gold: number }[]`

算法（纯函数，每次从日志重算，用设备本地日期）：
```
冒险日 = 有 done/partial 冒险的「开始」本地日期集合
tokens = 0; current = 0; best = 0
从 createdAt 的本地日期逐天走到今天：
  如果是创建日或周一：tokens = min(3, tokens + 2)
  加上当天购买的券：tokens = min(3, tokens + 当天购买数)
  如果这天是冒险日：current++，best = max(best, current)
  否则如果这天早于今天：tokens > 0 ? (tokens--, restDays.push(这天)) : current = 0
  （今天还没结束而且不是冒险日：不变）
```

- [ ] **Step 1: 写失败的测试**（用 `vitest.config.ts` 里 `env: { TZ: 'America/New_York' }` 固定时区；`runOn(dateStr, status)` 是测试里的小工具函数，造出一条在该日 10:00 开始的冒险）

```ts
test('consecutive adventure days count', () => {
  const s = computeStreak({ runs: [runOn('2026-11-02','done'), runOn('2026-11-03','partial'), runOn('2026-11-04','done')], createdAt: '2026-11-02T08:00:00-05:00', tokenPurchases: [], now: new Date('2026-11-04T20:00:00-05:00') });
  expect(s).toMatchObject({ current: 3, best: 3 });
});
test('empty past day uses a token and keeps streak', () => {
  const s = computeStreak({ runs: [runOn('2026-11-02','done'), runOn('2026-11-04','done')], createdAt: '2026-11-02T08:00:00-05:00', tokenPurchases: [], now: new Date('2026-11-04T20:00:00-05:00') });
  expect(s).toMatchObject({ current: 2, tokens: 1, restDays: ['2026-11-03'] });
});
test('streak resets when no tokens left', () => { /* 周一建档拿 2 张，周二到周四三天空白 → current 0，tokens 0 */ });
test('today not yet done does not break streak', () => { /* 昨天完成，今天 09:00 还没做 → current 1，restDays 为空 */ });
test('skipped and abandoned runs do not count', () => { /* 只有 skipped → current 0 */ });
test('late confirmation counts on start day', () => { /* 11-03 23:30 开始、11-04 才 settle 的 done → 11-03 算冒险日 */ });
test('monday grant respects cap of 3', () => { /* 连续冒险两周不用券 → tokens 3 */ });
test('purchased token is added on purchase day', () => { /* tokens 0 时当天买一张，第二天空白 → 用掉这张，current 不归零 */ });
test('pendingMilestones', () => {
  expect(pendingMilestones(8, [3])).toEqual([{ days: 7, gold: 50 }]);
  expect(pendingMilestones(2, [])).toEqual([]);
});
```

注释里写了情况的测试，执行时要写成完整断言，日期和数字按注释来。

- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现 `streak.ts`**：日期都用本地 `YYYY-MM-DD` 字符串比较，逐天推进用 `new Date(y, m, d + 1)`，避免夏令时那天少算或多算 24 小时
- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5: 提交** `feat(core): streak with rest tokens and milestones`

---

### Task 5: 场次推算、有效期、迅速接取、时段校验

**Files:**
- Create: `packages/core/src/schedule.ts`
- Test: `packages/core/test/schedule.test.ts`

**Interfaces:**
- Produces:
  - `localDate(d: Date): string` —— 本地 `YYYY-MM-DD`
  - `interface Occurrence { slotId: string; date: string; start: Date; end: Date }`
  - `occurrencesOn(slots: Slot[], date: string): Occurrence[]` —— 当天所有场次，按开始时间排序；`end` = 当天下一个场次的开始，或次日 00:00
  - `openOccurrence(slots: Slot[], now: Date): Occurrence | null` —— `start <= now < end` 的那个
  - `findOccurrence(slots: Slot[], slotId: string, date: string): Occurrence | null` —— 给通知链接用；场次不存在（时段被删、那天不在 weekdays 里）返回 null
  - `isQuick(occ: Occurrence | null, acceptedAt: Date): boolean` —— 有场次且 `0 <= acceptedAt - start <= 15 分钟`
  - `type SlotError = 'candidates' | 'weekdays' | 'time' | 'per_day' | 'duplicate'`
  - `validateSlot(slot: Slot, others: Slot[]): SlotError | null` —— 候选 2–3 个且不重复；weekdays 非空且都在 0–6；time 符合 `^([01]\d|2[0-3]):[0-5]\d$`；加上它以后每天不超过 6 个；同一天同一时间不能有两个时段（`others` 里排除自己的 id）
  - `validateQuest(q: Pick<Quest,'name'|'minutes'>): 'name' | 'minutes' | null` —— 名称去掉空格后 1–40 字；时长 5–480 的整数

- [ ] **Step 1: 写失败的测试**（TZ = America/New_York）

```ts
const mwf = { id: 'a', weekdays: [1, 3, 5], time: '19:00', questIds: ['q1', 'q2'] };
const mon21 = { id: 'b', weekdays: [1], time: '21:00', questIds: ['q1', 'q3'] };
test('occurrence window ends at next slot', () => {
  const [o1, o2] = occurrencesOn([mwf, mon21], '2026-11-09');
  expect(o1.end.getTime()).toBe(o2.start.getTime());
  expect(o2.end.getTime()).toBe(new Date(2026, 10, 10).getTime());
});
test('open occurrence', () => {
  expect(openOccurrence([mwf], new Date(2026, 10, 9, 18, 59))).toBeNull();
  expect(openOccurrence([mwf], new Date(2026, 10, 9, 19, 0))?.slotId).toBe('a');
  expect(openOccurrence([mwf], new Date(2026, 10, 10, 0, 0))).toBeNull(); // 周二没有场次
});
test('quick window is 15 minutes inclusive', () => {
  const o = findOccurrence([mwf], 'a', '2026-11-09')!;
  expect(isQuick(o, new Date(2026, 10, 9, 19, 15))).toBe(true);
  expect(isQuick(o, new Date(2026, 10, 9, 19, 15, 1))).toBe(false);
  expect(isQuick(null, new Date())).toBe(false);
});
test('findOccurrence rejects wrong weekday or missing slot', () => {
  expect(findOccurrence([mwf], 'a', '2026-11-10')).toBeNull();
  expect(findOccurrence([mwf], 'zzz', '2026-11-09')).toBeNull();
});
test('validateSlot', () => {
  expect(validateSlot({ ...mwf, questIds: ['q1'] }, [])).toBe('candidates');
  expect(validateSlot({ ...mwf, questIds: ['q1', 'q1'] }, [])).toBe('candidates');
  expect(validateSlot({ ...mwf, time: '24:00' }, [])).toBe('time');
  expect(validateSlot({ ...mwf, id: 'c' }, [mwf])).toBe('duplicate');
  const six = Array.from({ length: 6 }, (_, i) => ({ ...mwf, id: `s${i}`, time: `0${i}:00` }));
  expect(validateSlot({ ...mwf, id: 'x', time: '20:00' }, six)).toBe('per_day');
  expect(validateSlot(mwf, [mwf])).toBeNull(); // 编辑自己
});
test('validateQuest', () => {
  expect(validateQuest({ name: '  ', minutes: 30 })).toBe('name');
  expect(validateQuest({ name: '健身', minutes: 4 })).toBe('minutes');
  expect(validateQuest({ name: '健身', minutes: 481 })).toBe('minutes');
  expect(validateQuest({ name: '健身', minutes: 120 })).toBeNull();
});
```

- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现 `schedule.ts`**
- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5: 提交** `feat(core): slot occurrences, quick accept and validation`

---

### Task 6: 徽章、商店目录、备份校验

**Files:**
- Create: `packages/core/src/badges.ts`、`shop.ts`、`backup.ts`
- Test: `packages/core/test/badges.test.ts`、`shop.test.ts`、`backup.test.ts`

**Interfaces:**
- Produces（badges）:
  - `BADGE_IDS = ['first_done','first_partial','str_50','int_50','skl_50','streak_3','streak_7','streak_14','streak_30','streak_100','three_types_week','first_rest','rank_c','rank_s','quick_10'] as const`（`streak_N` 与 spec 5.3 的里程碑一一对应，以 `streakBest >= N` 判定；`rank_c` / `rank_s` 表示阶级达到或超过 C / S）
  - `earnedBadges(ctx: { runs: Run[]; quests: Quest[]; stats: Stats; streakBest: number; restDays: string[]; rank: Rank; now: Date }): BadgeId[]` —— 返回当前满足条件的全部徽章（调用方和 `profile.badges` 做差集就是新徽章）。`three_types_week` = 最近 7 个本地日内完成（done/partial）过三种属性的委托
- Produces（shop）:
  - `interface ShopItem { id: string; kind: 'hat' | 'cape' | 'background' | 'title' | 'rest_token'; price: number; minRank: Rank }`
  - `SHOP_ITEMS: ShopItem[]` —— 12 件非券商品，至少：hat 4、cape 3、background 3（forest/town/demon_castle）、title 2，外加 `rest_token`（价格 `TOKEN_PRICE`，最低 F）；价格 40–600，最低阶级覆盖 F 到 A
  - `type BuyCheck = 'ok' | 'rank' | 'gold' | 'owned' | 'token_cap'`
  - `checkBuy(item: ShopItem, s: { gold: number; rank: Rank; owned: string[]; tokens: number }): BuyCheck`
  - `newlyUnlocked(rankBefore: Rank, rankAfter: Rank): ShopItem[]`
- Produces（backup）:
  - `BACKUP_VERSION = 1`、`BACKUP_MAX_BYTES = 5_000_000`
  - `interface BackupFile { app: 'lazy-guild'; version: 1; exportedAt: string; data: GuildData }`
  - `makeBackup(data: GuildData, now: Date): BackupFile`
  - `parseBackup(text: string): { ok: true; data: GuildData } | { ok: false; error: 'too_large' | 'not_json' | 'wrong_app' | 'newer_version' | 'invalid' }` —— 用 zod schema 校验 `GuildData` 的每个字段（包括 Task 5 的取值范围）

- [ ] **Step 1: 写失败的测试**

```ts
// badges
test('first_done and quick_10', () => { /* 10 条 quick 的 done → 包含 first_done 和 quick_10，不包含 first_partial */ });
test('three types within 7 days', () => { /* STR、INT、SKL 各一条且都在 7 天内 → 有；其中一条在 8 天前 → 没有 */ });
test('stat and rank badges', () => {
  expect(earnedBadges({ ...base, stats: { STR: 50, INT: 49, SKL: 0 }, rank: 'C' })).toEqual(expect.arrayContaining(['str_50', 'rank_c']));
});
// shop
test('catalog shape', () => {
  const nonToken = SHOP_ITEMS.filter((i) => i.kind !== 'rest_token');
  expect(nonToken.length).toBeGreaterThanOrEqual(12);
  expect(new Set(SHOP_ITEMS.map((i) => i.id)).size).toBe(SHOP_ITEMS.length);
});
test('checkBuy order', () => {
  const hat = SHOP_ITEMS.find((i) => i.kind === 'hat' && i.minRank === 'C')!;
  expect(checkBuy(hat, { gold: 9999, rank: 'D', owned: [], tokens: 0 })).toBe('rank');
  expect(checkBuy(hat, { gold: 0, rank: 'C', owned: [], tokens: 0 })).toBe('gold');
  expect(checkBuy(hat, { gold: 9999, rank: 'C', owned: [hat.id], tokens: 0 })).toBe('owned');
  const token = SHOP_ITEMS.find((i) => i.kind === 'rest_token')!;
  expect(checkBuy(token, { gold: 9999, rank: 'F', owned: [], tokens: 3 })).toBe('token_cap');
});
// backup —— Review Focus 5
test('round trip', () => { const b = makeBackup(sample, now); expect(parseBackup(JSON.stringify(b))).toEqual({ ok: true, data: sample }); });
test('rejects other apps, newer versions, junk, huge files', () => {
  expect(parseBackup('{"foo":1}')).toEqual({ ok: false, error: 'wrong_app' });
  expect(parseBackup(JSON.stringify({ ...makeBackup(sample, now), version: 2 }))).toEqual({ ok: false, error: 'newer_version' });
  expect(parseBackup('not json')).toEqual({ ok: false, error: 'not_json' });
  expect(parseBackup('x'.repeat(5_000_001))).toEqual({ ok: false, error: 'too_large' });
  const bad = makeBackup(sample, now); bad.data.quests[0].minutes = 9999;
  expect(parseBackup(JSON.stringify(bad))).toEqual({ ok: false, error: 'invalid' });
});
```

- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现三个文件**，并在 `index.ts` 导出
- [ ] **Step 4: 运行 `pnpm --filter @lazy-guild/core test`** → 全部 PASS
- [ ] **Step 5: 提交** `feat(core): badges, shop catalog and backup validation`

---

### Task 7: 推送服务——数据库和 HTTP 接口

**Files:**
- Create: `apps/push-worker/package.json`、`tsconfig.json`、`wrangler.toml`、`vitest.config.ts`、`migrations/0001_init.sql`、`src/index.ts`、`src/routes.ts`、`src/auth.ts`、`src/validate.ts`、`scripts/vapid.mjs`
- Test: `apps/push-worker/test/routes.test.ts`

**Interfaces:**
- `wrangler.toml`：`name = "lazy-guild-push"`、D1 绑定 `DB`、`[triggers] crons = ["* * * * *"]`、vars `VAPID_PUBLIC_KEY`、`VAPID_SUBJECT`、`ALLOWED_ORIGIN`；secret `VAPID_PRIVATE_KEY`（不写进文件）
- `0001_init.sql`：
  ```sql
  CREATE TABLE devices (id TEXT PRIMARY KEY, secret_hash TEXT NOT NULL, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, tz TEXT NOT NULL, lang TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE slot_times (device_id TEXT NOT NULL, slot_id TEXT NOT NULL, weekday INTEGER NOT NULL, hhmm TEXT NOT NULL, PRIMARY KEY (device_id, slot_id, weekday));
  CREATE TABLE one_offs (device_id TEXT NOT NULL, id TEXT NOT NULL, at TEXT NOT NULL, kind TEXT NOT NULL, run_id TEXT NOT NULL, PRIMARY KEY (device_id, id));
  CREATE TABLE sent_log (device_id TEXT NOT NULL, key TEXT NOT NULL, sent_at TEXT NOT NULL, PRIMARY KEY (device_id, key));
  CREATE INDEX one_offs_at ON one_offs(at);
  ```
  外键关系由代码保证：删除设备时同时删它的 slot_times、one_offs、sent_log
- `auth.ts`：`generateSecret(): string`（32 字节随机数，base64url）、`hashSecret(s: string): Promise<string>`（SHA-256 hex）、`authorize(req: Request, env: Env, deviceId: string): Promise<boolean>`
- `validate.ts`（zod）：`SubscriptionBody = { endpoint: https URL; keys: { p256dh: string; auth: string } }`、`DeviceBody = { subscription; tz; lang: 'zh'|'en' }`（tz 用 `Intl.DateTimeFormat(undefined, { timeZone })` 验证，不合法就 400）、`SlotsBody = { slots: { slotId: string; weekdays: number[]; time: 'HH:mm' }[] }`（最多 42 个）、`OneOffBody = { at: ISO 字符串; kind: 'confirm'; runId: string }`；请求体超过 16 KB 返回 413
- 路由：照 spec 6.3 的表格。`POST /devices` 返回 `201 { id, secret }`；成功的修改返回 `204`；鉴权失败返回 `401`；设备不存在返回 `404`。所有响应带 CORS：`Access-Control-Allow-Origin: env.ALLOWED_ORIGIN`，并处理 `OPTIONS` 预检
- `scripts/vapid.mjs`：用 WebCrypto 生成 P-256 密钥对，打印 base64url 公钥和 JWK 私钥，给 `docs/deploy.md` 用

- [ ] **Step 1: 写失败的测试**（`@cloudflare/vitest-pool-workers`，`SELF.fetch`，每个测试前对 D1 执行迁移）

```ts
test('register then authorized slot replace', async () => {
  const reg = await SELF.fetch('https://w/devices', { method: 'POST', body: JSON.stringify(deviceBody) });
  expect(reg.status).toBe(201);
  const { id, secret } = await reg.json();
  const put = await SELF.fetch(`https://w/devices/${id}/slots`, { method: 'PUT', headers: { Authorization: `Bearer ${secret}` }, body: JSON.stringify({ slots: [{ slotId: 'a', weekdays: [1, 3], time: '19:00' }] }) });
  expect(put.status).toBe(204);
  expect((await env.DB.prepare('SELECT COUNT(*) n FROM slot_times').first()).n).toBe(2);
});
test('wrong secret is 401, unknown device is 404', async () => { /* … */ });
test('invalid tz / lang / time / oversized body rejected', async () => { /* tz "Mars/Base" → 400；lang "fr" → 400；time "25:00" → 400；17 KB → 413 */ });
test('slots PUT replaces, not appends', async () => { /* PUT 两次，第二次只留 1 条 */ });
test('one-off upsert and delete', async () => { /* PUT 两次同一个 oid → 1 行；DELETE → 0 行 */ });
test('DELETE device removes all rows', async () => { /* 四张表都清空 */ });
test('CORS preflight', async () => { /* OPTIONS → 204 + Allow-Origin */ });
test('stores no quest names', async () => { /* 请求体多带 name 字段 → 被 zod 丢弃，表里没有这一列 */ });
```

- [ ] **Step 2: 运行确认失败**：`pnpm --filter @lazy-guild/push-worker test`
- [ ] **Step 3: 实现接口**
- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5: 提交** `feat(push): device, slot and one-off API on D1`

---

### Task 8: 推送服务——每分钟发送

**Files:**
- Create: `apps/push-worker/src/due.ts`、`dispatch.ts`、`push.ts`、`messages.ts`
- Modify: `apps/push-worker/src/index.ts`（加 `scheduled` 处理）
- Test: `apps/push-worker/test/due.test.ts`、`dispatch.test.ts`

**Interfaces:**
- `due.ts`：`localParts(at: Date, tz: string): { date: string; weekday: number; hhmm: string }`（用 `Intl.DateTimeFormat` 的 `formatToParts`）、`LOOKBACK_MINUTES = 5`、`dueSlotKeys(rows: { slot_id: string; weekday: number; hhmm: string }[], tz: string, now: Date): { slotId: string; date: string; key: string }[]` —— 对 `now` 和往前 1–4 分钟各算一次 `localParts`，匹配上的时段生成 `key = "${slotId}@${date}"`，去重
- `push.ts`：
  ```ts
  export interface NotificationPayload { kind: 'slot' | 'confirm'; title: string; body: string; url: string; tag: string }
  export interface PushSender { send(sub: { endpoint: string; p256dh: string; auth: string }, payload: NotificationPayload): Promise<{ status: number }> }
  export function createWebPushSender(env: Env): PushSender // 用 @block65/webcrypto-web-push，TTL 3600
  ```
- `messages.ts`：`slotMessage(lang: Lang): { title; body }` → zh `⚔️ 新的委托到了！` / `点开挑一个吧`；en `⚔️ A new quest has arrived!` / `Tap to pick one`。`confirmMessage(lang)` → zh `委托完成了吗？` / `点开告诉公会结果`；en `Quest finished?` / `Tap to report back`
- `dispatch.ts`：`runDispatch(env: Env, now: Date, sender: PushSender): Promise<{ sent: number; removed: number }>`
  - slot 通知：`url = /choose?slot=<slotId>&date=<date>`，`tag = slot:<key>`；先写 `sent_log`（`INSERT OR IGNORE`，有变化才发），防止重复
  - one-off：`at <= now` 的全部发出，`url = /confirm?run=<runId>`，`tag = confirm:<runId>`，发完删除这一行
  - sender 返回 404 / 410 → 删除这台设备的全部数据，`removed++`；其他非 2xx 状态 → 记日志，不删设备，one-off 保留到下一分钟再试（最多保留到 `at` 之后 1 小时）
  - 每次运行顺带删掉 3 天前的 `sent_log`
- `index.ts`：`scheduled(event, env, ctx)` → `ctx.waitUntil(runDispatch(env, new Date(event.scheduledTime), createWebPushSender(env)))`

- [ ] **Step 1: 写失败的测试**

```ts
// due.test.ts
test('matches local time in device tz', () => {
  // 2026-11-09 19:00 America/New_York = 2026-11-10T00:00Z
  expect(dueSlotKeys([{ slot_id: 'a', weekday: 1, hhmm: '19:00' }], 'America/New_York', new Date('2026-11-10T00:00:30Z')))
    .toEqual([{ slotId: 'a', date: '2026-11-09', key: 'a@2026-11-09' }]);
});
test('lookback catches a late cron (Review Focus 1)', () => {
  expect(dueSlotKeys([{ slot_id: 'a', weekday: 1, hhmm: '19:00' }], 'America/New_York', new Date('2026-11-10T00:04:10Z'))).toHaveLength(1);
  expect(dueSlotKeys([{ slot_id: 'a', weekday: 1, hhmm: '19:00' }], 'America/New_York', new Date('2026-11-10T00:05:10Z'))).toHaveLength(0);
});
test('DST spring-forward skipped time never matches', () => {
  // 2027-03-14 02:30 不存在于 America/New_York
  const rows = [{ slot_id: 'a', weekday: 0, hhmm: '02:30' }];
  for (let m = 0; m < 120; m++) expect(dueSlotKeys(rows, 'America/New_York', new Date(Date.parse('2027-03-14T06:30:00Z') + m * 60000))).toHaveLength(0);
});
test('DST fall-back repeated time yields same key', () => { /* 2026-11-01 01:30 出现两次，两次返回的 key 相同 */ });

// dispatch.test.ts（fake sender 记录调用）
test('sends slot once even if cron runs repeatedly', async () => { /* 连续 runDispatch 3 次（每次 +1 分钟），sender 只被调用 1 次，payload.url 是 /choose?slot=a&date=2026-11-09 */ });
test('payload language follows device lang and has no quest names', async () => { /* en 设备 → title 是 "⚔️ A new quest has arrived!" */ });
test('one-off sent when due, then deleted', async () => { /* … */ });
test('410 removes device', async () => { /* sender 返回 410 → devices 为空，返回 removed 1 */ });
test('500 keeps one-off for retry', async () => { /* sender 返回 500 → one_offs 还在 */ });
```

- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现**
- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5: 提交** `feat(push): minute dispatcher with lookback, dedupe and cleanup`

---

### Task 9: 网页骨架——路由、i18n、数据库、PWA 外壳

**Files:**
- Create: `apps/web/package.json`、`vite.config.ts`、`tsconfig.json`、`index.html`、`public/icons/*`（原创 SVG 图标导出的 192/512 PNG）、`src/main.tsx`、`src/App.tsx`、`src/sw.ts`（这一步只做 precache）、`src/db.ts`、`src/lib/clock.ts`、`src/lib/id.ts`、`src/i18n/index.ts`、`src/i18n/zh.json`、`src/i18n/en.json`、`src/components/Layout.tsx`、`src/components/TabBar.tsx`、`src/styles.css`、`test/setup.ts`
- Test: `apps/web/test/i18n.test.ts`、`apps/web/test/db.test.ts`

**Interfaces:**
- `db.ts`：`class GuildDB extends Dexie`，version 1，表：`profile: 'id'`、`quests: 'id'`、`slots: 'id'`、`runs: 'id, status, startedAt'`、`kv: 'key'`。导出 `db`、`resetDb()`（测试用），以及 `loadGuildData(): Promise<GuildData | null>`（没有 profile 时返回 null）、`replaceGuildData(d: GuildData): Promise<void>`（一个事务里清空再写入）
- `kv` 的键：`lang`、`pushDevice`（`{ id, secret }`）、`pushQueue`（`PushOp[]`，Task 13 定义）、`lastTz`、`backupReminderOff`
- `lib/clock.ts`：`now(): Date`（只是 `new Date()`，集中在这里方便端到端测试用假时钟）；`lib/id.ts`：`newId(): string`（`crypto.randomUUID()`）
- `i18n/index.ts`：`initI18n(lang?: Lang)`、`detectLang(): Lang`（`navigator.language` 以 `zh` 开头就是 zh，否则 en）、`setLang(lang: Lang): Promise<void>`（写进 kv，并调用 Task 13 的 `pushClient.updateLang`，Task 13 之前先留空函数）
- 路由（react-router `createBrowserRouter`）：`/onboarding`、`/`、`/choose`、`/run`、`/confirm`、`/plan`、`/quests`、`/profile`、`/shop`、`/settings`。没有 profile 时除 `/onboarding` 外都跳到 `/onboarding`。底部 TabBar：大厅 / 计划 / 委托库 / 档案 / 设置
- `vite.config.ts`：`VitePWA({ strategies: 'injectManifest', srcDir: 'src', filename: 'sw.ts', manifest: { name: '懒人公会 Lazy Guild', short_name: '懒人公会', display: 'standalone', start_url: '/', theme_color, background_color, icons } })`；Vitest 用 jsdom，setup 文件里 `import 'fake-indexeddb/auto'`，`env.TZ = 'America/New_York'`

- [ ] **Step 1: 写失败的测试**

```ts
// i18n.test.ts
import zh from '../src/i18n/zh.json'; import en from '../src/i18n/en.json';
const keys = (o: object, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]);
test('zh and en have identical keys', () => expect(keys(zh).sort()).toEqual(keys(en).sort()));
test('no empty strings', () => { for (const k of [...keys(zh), ...keys(en)]) expect(k).toBeTruthy(); });
// db.test.ts
test('loadGuildData returns null before onboarding', async () => { await resetDb(); expect(await loadGuildData()).toBeNull(); });
test('replaceGuildData round trip', async () => { await replaceGuildData(sample); expect(await loadGuildData()).toEqual(sample); });
```

- [ ] **Step 2: 运行确认失败**：`pnpm --filter @lazy-guild/web test`
- [ ] **Step 3: 实现骨架**（页面先放占位组件，Task 11、12 再补内容）
- [ ] **Step 4: 运行测试 + `pnpm --filter @lazy-guild/web build`** → PASS，`dist/` 里有 `sw.js` 和 `manifest.webmanifest`
- [ ] **Step 5: 提交** `feat(web): app shell with routing, i18n, IndexedDB and PWA`

---

### Task 10: 网页游戏服务——开档、接取、结算、放弃、购买、计划管理

**Files:**
- Create: `apps/web/src/services/guild.ts`、`apps/web/src/services/plan.ts`
- Test: `apps/web/test/guild.test.ts`、`apps/web/test/plan.test.ts`

**Interfaces:**
- Consumes: core 的 `computeReward`、`progressDelta`、`computeStreak`、`pendingMilestones`、`earnedBadges`、`checkBuy`、`newlyUnlocked`、`findOccurrence`、`isQuick`、`validateSlot`、`validateQuest`；Task 9 的 `db`、`now`、`newId`
- Produces（guild.ts）:
  - `createProfile(name: string, species: Species, lang: Lang): Promise<void>` —— 写 profile，并按语言预置 4 个委托：健身 STR 120 / 学习一小时 INT 60 / 写作业 INT 90 / 推进项目 SKL 60（en：Workout / Study 1h / Homework / Side project）
  - `getActiveRun(): Promise<Run | null>`
  - `acceptQuest(input: { questId: string; slotId: string | null; date: string | null; replaceActive?: boolean }): Promise<{ ok: true; run: Run } | { ok: false; reason: 'active_exists' | 'quest_missing' }>` —— 有进行中的冒险且没有 `replaceActive` 时返回 `active_exists`；`replaceActive` 时先把旧的标为 `abandoned`；`quick = isQuick(findOccurrence(...), now())`；`endsAt = now + minutes`；之后调用 `pushClient.scheduleConfirm(run)`（Task 13 前是空函数）
  - `interface SettleResult { reward: Reward; delta: ReturnType<typeof progressDelta>; newBadges: BadgeId[]; milestoneGold: number; unlocked: ShopItem[] }`
  - `settleRun(runId: string, outcome: Outcome): Promise<SettleResult | null>` —— 在一个 Dexie `rw` 事务里：重新读 run，不是 `active` 就返回 null（幂等）；算奖励；更新 `totalXp`、`gold`、`stats`；重算连续天数，领取未领的里程碑金币；计算新徽章；写回；事务结束后调用 `pushClient.cancelConfirm(runId)`
  - `abandonRun(runId: string): Promise<void>` —— 只有 active 才会变成 abandoned，也取消提醒
  - `buyItem(itemId: string): Promise<BuyCheck>` —— 休息券记进 `tokenPurchases`，其他物品进 `owned`
  - `equip(slot: keyof Equipped, itemId: string | null): Promise<void>` —— 只能装备已经拥有的
  - `guildSummary(): Promise<{ profile; level; rank; stage; streak; activeRun; openOcc }>` —— 首页用
- Produces（plan.ts）:
  - `saveQuest(q: Omit<Quest,'id'|'archived'> & { id?: string }): Promise<{ ok: true; id: string } | { ok: false; error: 'name' | 'minutes' }>`
  - `removeQuest(id: string): Promise<'deleted' | 'archived'>` —— 被任何 run 或 slot 引用就归档，同时从各个 slot 的候选里删掉；某个 slot 因此只剩 1 个候选时，返回值不变，但这个 slot 在计划页标记"需要补候选"
  - `saveSlot(s: Omit<Slot,'id'> & { id?: string }): Promise<{ ok: true; id: string } | { ok: false; error: SlotError }>`
  - `removeSlot(id: string): Promise<void>`
  - 每次时段变化后调用 `pushClient.syncSlots()`
  - `candidatesFor(slotId: string): Promise<Quest[]>` —— 只返回没归档的委托

- [ ] **Step 1: 写失败的测试**（fake-indexeddb + `vi.setSystemTime`）

```ts
test('accept → settle done awards xp and gold once (Review Focus 4)', async () => {
  await createProfile('Ray', 'slime', 'zh');
  const q = (await db.quests.toArray()).find((x) => x.minutes === 120)!;
  const { run } = (await acceptQuest({ questId: q.id, slotId: null, date: null })) as any;
  const [a, b] = await Promise.all([settleRun(run.id, 'done'), settleRun(run.id, 'done')]);
  expect([a, b].filter(Boolean)).toHaveLength(1);
  expect((await db.profile.get('me'))!.totalXp).toBe(60);
});
test('second accept blocked unless replaceActive', async () => { /* 第二次 → active_exists；replaceActive → 旧的变成 abandoned、只有 1 个 active */ });
test('quick flag from occurrence', async () => { /* 时段 19:00，19:10 接取 → quick true，结算 xp 72（120 分钟 ×1.2） */ });
test('partial and skipped', async () => { /* partial → 30 xp；skipped → totalXp 不变，status skipped */ });
test('level up and rank change reported', async () => { /* totalXp 预设 90 → 完成 60 xp → delta.levelAfter 2 */ });
test('milestone gold claimed once', async () => { /* 造出连续 3 天的冒险日 → milestoneGold 20，claimedMilestones 有 3；再结算一次 → 0 */ });
test('removeQuest archives when referenced (Review Focus 2)', async () => {
  // 委托被进行中的冒险引用 → 'archived'；candidatesFor 不再返回它；getActiveRun 仍能取到它的名称
});
test('saveSlot surfaces validation errors', async () => { /* 只有 1 个候选 → { ok:false, error:'candidates' } */ });
test('buyItem', async () => { /* 金币不够 → 'gold'，金币不变；够了 → 'ok'，owned 里有它，金币减少 */ });
```

- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现两个服务**
- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5: 提交** `feat(web): guild and plan services with idempotent settlement`

---

### Task 11: 原创美术、伙伴台词、核心循环页面

**Files:**
- Create: `apps/web/src/art/Companion.tsx`、`art/backgrounds.tsx`、`art/cosmetics.tsx`、`content/lines.ts`
- Create: `apps/web/src/components/QuestCard.tsx`、`RewardSummary.tsx`、`CompanionBubble.tsx`
- Modify（替换占位）: `apps/web/src/pages/Onboarding.tsx`、`Hall.tsx`、`Choose.tsx`、`Run.tsx`、`Confirm.tsx`
- Modify: `src/i18n/zh.json`、`en.json`（台词和页面文字）
- Test: `apps/web/test/lines.test.ts`、`apps/web/test/pages/core-loop.test.tsx`

**Interfaces:**
- `Companion`：`<Companion species={Species} stage={Stage} equipped={Equipped} size?={number} />` —— 3 种 × 3 形态的内联 SVG；帽子和披风按 id 叠在上面
- `Background`：`<Background id={string | null} />`（默认是公会大厅，另有 forest、town、demon_castle）
- `lines.ts`：`type Occasion = 'greet' | 'accept' | 'done' | 'partial' | 'skipped' | 'levelUp' | 'evolve' | 'rest'`；`pickLine(t: TFunction, species: Species, occasion: Occasion, rand = Math.random): string`；i18n 键是 `lines.<species>.<occasion>`，每个都是至少 3 句的数组
- 页面行为：
  - **Onboarding**：名字（1–20 字）→ 三选一伙伴 → "添加到主屏幕并开启通知"说明页（按钮调用 `pushClient.enable()`，可以跳过）→ 跳到 `/plan?new=1`
  - **Hall**：伙伴 + 台词、名字、称号、等级进度条、阶级、金币、连续天数、休息券数量；进行中的冒险卡片（剩余时间）；今天的时段列表；"现在就接个委托"按钮 → `/choose`。**进入时如果进行中的冒险已经过了 `endsAt`，直接跳到 `/confirm?run=<id>`**；超过 30 天没备份、而且没关掉提醒时显示提示条
  - **Choose**：有 `slot` 和 `date` 参数时，用 `findOccurrence` 找场次；场次不存在或已过期 → 显示"这个委托已经过期了"，并给一个"自由委托"按钮。没有参数时列出全部没归档的委托（自由委托）。点卡片调用 `acceptQuest`；返回 `active_exists` → 弹框问"先把当前的做完 / 放弃当前的，接新的"
  - **Run**：倒计时（每秒刷新）、伙伴台词、"提前完成"（→ `/confirm`）和"放弃"（二次确认 → `abandonRun` → 大厅）
  - **Confirm**：三个大按钮"完成 / 做了一部分 / 没做" → `settleRun` → 结算画面：`RewardSummary`（经验、金币、属性 +N、升级、进化动画、新徽章、里程碑、解锁的商品）+ 对应场合的台词。run 已经结算过（`settleRun` 返回 null）→ 显示"这个委托已经结算过了"并回到大厅

- [ ] **Step 1: 写失败的测试**

```ts
// lines.test.ts
test.each(['slime', 'foxfire', 'drake'])('%s has ≥3 lines per occasion in both languages', async (sp) => {
  for (const lang of ['zh', 'en'] as const) for (const occ of OCCASIONS) expect(resources[lang].lines[sp][occ].length).toBeGreaterThanOrEqual(3);
});
// core-loop.test.tsx（Testing Library + MemoryRouter，fake-indexeddb，i18n 用 zh）
test('choose from slot link → run → confirm done shows reward', async () => { /* 建档、建 19:00 时段、系统时间 19:05、渲染 /choose?slot=..&date=.. → 点"健身" → 跳到 /run → 点"提前完成" → 点"完成" → 看到 "+72" 经验 */ });
test('expired occurrence offers free quest', async () => { /* date 用昨天 → 看到"这个委托已经过期了" */ });
test('overdue active run redirects hall to confirm (Review Focus 3)', async () => { /* 接取 120 分钟后，系统时间快进 2 天，渲染 / → 显示 Confirm 页；结算后在冒险日志里，日期是开始那天 */ });
test('active run conflict dialog', async () => { /* 已有进行中的冒险 → 选新的 → 看到两个选项 */ });
```

- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现美术、台词和页面**
- [ ] **Step 4: 运行确认通过**；`pnpm --filter @lazy-guild/web dev` 后用 Playwright 在 390×844 下截图检查：没有横向滚动，伙伴三种形态都能正常显示
- [ ] **Step 5: 提交** `feat(web): companions, lines and core quest loop pages`

---

### Task 12: 计划、委托库、档案、商店、设置页面

**Files:**
- Modify（替换占位）: `apps/web/src/pages/Plan.tsx`、`Quests.tsx`、`Profile.tsx`、`Shop.tsx`、`Settings.tsx`
- Create: `apps/web/src/services/backup.ts`
- Test: `apps/web/test/pages/manage.test.tsx`、`apps/web/test/backup.test.ts`

**Interfaces:**
- `services/backup.ts`：`exportBackupFile(): Promise<Blob>`（同时更新 `lastBackupAt`）、`importBackupText(text: string): Promise<{ ok: true } | { ok: false; error: string }>` —— `parseBackup` 通过后，先 `exportBackupFile()` 生成一份当前数据，触发下载（文件名 `lazy-guild-before-import-<日期>.json`），再 `replaceGuildData`，最后 `pushClient.syncSlots()`
- 页面：
  - **Plan**：七天视图（周一在前），每天列出时段，可以新增或编辑：选星期几（多选）、时间、2–3 个候选（多选，超过 3 个不让选）。校验错误显示对应 `SlotError` 的 i18n 文案。候选不足 2 个的时段标红并写"需要补候选"。`?new=1` 时直接打开新增表单
  - **Quests**：列表加编辑表单（名称、类型三选一、时长 5–480 分钟的数字输入加快捷按钮 30/60/90/120、图标从 12 个 emoji 里选）；删除时被引用就提示"已归档"
  - **Profile**：三项属性条、等级和阶级、徽章墙（没拿到的显示灰色和获得条件）、冒险日志（只列 done 和 partial，按日期分组，显示委托名、时长、奖励）
  - **Shop**：按类型分组；显示价格、阶级要求；`checkBuy` 不是 ok 的显示原因；已拥有的显示"装备 / 卸下"
  - **Settings**：语言切换（中文 / English）、通知状态和开关（Task 13 接上）、导出备份、导入备份（文件选择 → 确认框 → 结果）、关闭备份提醒、关于（版本号、GitHub 链接、MIT）

- [ ] **Step 1: 写失败的测试**

```ts
test('plan form blocks 4th candidate and shows per_day error', async () => { /* … */ });
test('quest form rejects 481 minutes with message', async () => { /* … */ });
test('log lists only done and partial', async () => { /* 造 done、partial、skipped、abandoned 各一条 → 日志只有 2 条 */ });
test('shop shows rank lock and gold shortage', async () => { /* … */ });
test('language switch updates UI', async () => { /* 点 English → 标签栏显示 "Hall" */ });
// backup.test.ts
test('import replaces data and keeps a pre-import export', async () => { /* … */ });
test('bad import leaves data untouched', async () => { /* importBackupText('{}') → ok:false；loadGuildData 不变 */ });
```

- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现页面和备份服务**
- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5: 提交** `feat(web): plan, quest library, profile, shop and settings pages`

---

### Task 13: 推送客户端和 Service Worker

**Files:**
- Create: `apps/web/src/push/client.ts`
- Modify: `apps/web/src/sw.ts`（加 push 和 notificationclick 处理）、`src/main.tsx`（启动时调用 `pushClient.onStartup()`）、`src/pages/Settings.tsx`、`src/pages/Hall.tsx`（通知没开时的提示）
- Test: `apps/web/test/push-client.test.ts`、`apps/web/test/sw.test.ts`

**Interfaces:**
- 配置：`import.meta.env.VITE_PUSH_API`（推送服务地址）；没配置时状态为 `unconfigured`
- `type PushOp = { op: 'slots' } | { op: 'confirm'; runId: string; at: string } | { op: 'cancel'; runId: string } | { op: 'device' }`
- `type PushStatus = 'synced' | 'pending' | 'off' | 'unsupported' | 'unconfigured' | 'denied'`
- `pushClient`：
  - `enable(): Promise<PushStatus>` —— 检查 `'PushManager' in window` 和 `Notification.requestPermission()`；`pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`（公钥从 `GET /vapid-public-key` 获取）；`POST /devices`，凭证存进 kv `pushDevice`；然后整体同步时段
  - `disable(): Promise<void>` —— `DELETE /devices/:id`，退订，清空 kv
  - `syncSlots()`、`scheduleConfirm(run: Run)`、`cancelConfirm(runId: string)`、`updateLang(lang)` —— 先把 op 放进 `pushQueue`，再 `flush()`；同一类 op 合并（`slots` 只保留一个；同一个 run 的 `confirm` 后面跟着 `cancel` 时两个都删掉）
  - `flush(): Promise<void>` —— 按顺序发送，成功的移出队列；网络错误就停下等下次；`401` / `404` → 清掉设备凭证，状态变成 `off`
  - `status(): Promise<PushStatus>`
  - `onStartup(): Promise<void>` —— flush；检查 `pushManager.getSubscription()`，订阅还在但 endpoint 变了就 `PUT /devices/:id`，订阅没了就重新 `enable`（权限已经是 granted 时）；比较 `Intl.DateTimeFormat().resolvedOptions().timeZone` 和 kv `lastTz`，不同就发 `device` op；`window` 的 `online` 事件也触发 flush
  - 一次性提醒的 id 就用 runId；`at = run.endsAt`
- `sw.ts`：`push` 事件 → `showNotification(title, { body, tag, data: { url }, icon })`；`notificationclick` → 如果已经有打开的窗口，就 `focus()` 再 `navigate(url)`，否则 `clients.openWindow(url)`

- [ ] **Step 1: 写失败的测试**（`fetch` 用 `vi.fn` 替身；`PushManager` 和 `Notification` 用测试替身）

```ts
test('unconfigured when VITE_PUSH_API missing', async () => { expect(await pushClient.status()).toBe('unconfigured'); });
test('enable registers device and syncs slots', async () => { /* fetch 依次被调用：GET /vapid-public-key、POST /devices、PUT /devices/:id/slots；slots 请求体里只有 slotId/weekdays/time，没有委托名称 */ });
test('offline ops queue, merge and flush later', async () => { /* fetch 抛错 → 状态 pending，队列里只有 1 个 slots op；恢复后 flush → synced，队列为空 */ });
test('confirm followed by cancel collapses', async () => { /* 离线时 scheduleConfirm + cancelConfirm → 队列为空 */ });
test('401 clears credentials and reports off', async () => { /* … */ });
test('timezone change triggers device update on startup', async () => { /* kv lastTz = Asia/Shanghai，当前是 America/New_York → 发出 PUT /devices/:id，请求体 tz 是 America/New_York */ });
// sw.test.ts：把 push / notificationclick 的处理函数单独导出来测
test('notificationclick focuses existing client and navigates', async () => { /* … */ });
```

- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现**，把 Task 9 和 Task 10 留的空函数换成真实调用
- [ ] **Step 4: 运行确认通过**，并且用 `wrangler dev`（本地 D1）加 `VITE_PUSH_API=http://localhost:8787` 手动走一遍：开启通知 → `wrangler` 的 D1 里有设备和时段
- [ ] **Step 5: 提交** `feat(web): push client with offline queue and service worker handlers`

---

### Task 14: 端到端测试

**Files:**
- Create: `apps/web/playwright.config.ts`、`apps/web/e2e/full-loop.spec.ts`、`e2e/offline.spec.ts`、`e2e/i18n-backup.spec.ts`
- Modify: `.github/workflows/ci.yml`（加 Playwright 任务）、`apps/web/package.json`（`e2e` 脚本）

**Interfaces:**
- `playwright.config.ts`：`webServer: pnpm build && pnpm preview --port 4173`；`use: { ...devices['iPhone 14'], browserName: 'chromium', timezoneId: 'America/New_York', locale: 'zh-CN' }`
- 每个测试先 `page.clock.install({ time: new Date('2026-11-09T18:55:00-05:00') })`

- [ ] **Step 1: 写测试**

```ts
test('full loop: onboarding → slot → choose → confirm → level up', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('冒险者名字').fill('Ray');
  await page.getByRole('button', { name: '史莱姆' }).click();
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByRole('button', { name: '先跳过' }).click();
  // 建时段：周一 19:00，候选 健身 / 学习一小时
  // ...
  await page.clock.fastForward('05:00');
  await page.goto(`/choose?slot=${slotId}&date=2026-11-09`); // 模拟点了通知
  await page.getByRole('button', { name: /健身/ }).click();
  await expect(page).toHaveURL(/\/run/);
  await page.clock.fastForward('02:00:00');
  await page.goto('/');
  await expect(page).toHaveURL(/\/confirm/);
  await page.getByRole('button', { name: '完成' }).click();
  await expect(page.getByText('+72')).toBeVisible();   // 120 分钟 + 迅速接取
  await expect(page.getByText('Lv 1')).toBeVisible();  // 72 < 100，还没升级
});
test('offline: app loads and quest can be accepted without network', async ({ page, context }) => { /* 先在线访问一次让 SW 缓存，再 context.setOffline(true)，重新加载 → 大厅可用，自由委托可以接取 */ });
test('language switch and backup export/import', async ({ page }) => { /* 切到 English → 标签栏 "Hall"；导出 → 改名字 → 导入刚才的文件 → 名字恢复 */ });
test('no horizontal scroll on every page', async ({ page }) => { /* 遍历 10 个路由，scrollWidth <= clientWidth */ });
```

- [ ] **Step 2: 运行**：`pnpm --filter @lazy-guild/web e2e` → 先 FAIL 的话修实现，直到全部 PASS
- [ ] **Step 3: CI 加任务** `e2e`：`pnpm exec playwright install --with-deps chromium` → `pnpm --filter @lazy-guild/web e2e`，失败时上传 `playwright-report`
- [ ] **Step 4: 提交** `test(web): end-to-end flows with fake clock`

---

### Task 15: 部署、文档、README

**Files:**
- Create: `.github/workflows/deploy.yml`、`docs/deploy.md`、`docs/iphone-guide.md`、`apps/web/scripts/screenshots.ts`、`docs/screenshots/*.png`、`README.md`（中文）、`README.en.md`（英文）
- Modify: 根 `package.json`（`screenshots` 脚本）

**Interfaces:**
- `deploy.yml`：在 main 分支的 CI 成功后触发（`workflow_run`）；如果 `secrets.CLOUDFLARE_API_TOKEN` 为空就跳过所有步骤并打印提示；步骤：`wrangler d1 migrations apply lazy-guild --remote` → `wrangler deploy`（push-worker）→ 用 `VITE_PUSH_API=${{ vars.PUSH_API_URL }}` 构建 web → `wrangler pages deploy apps/web/dist --project-name lazy-guild`
- 需要的 GitHub 配置：Secrets `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`；Variables `PUSH_API_URL`
- `docs/deploy.md`：给第一次用 Cloudflare 的人写，每一步都写清楚点哪里：
  1. 注册账号
  2. 创建 API token（权限：Workers Scripts、D1、Pages 编辑）
  3. 找到 Account ID
  4. `wrangler d1 create lazy-guild`，把 id 填进 `wrangler.toml`
  5. `node apps/push-worker/scripts/vapid.mjs` 生成密钥，`wrangler secret put VAPID_PRIVATE_KEY`
  6. 在 GitHub 的 Settings → Secrets and variables 里填好
  7. 推一次 main，检查是否部署成功
  8. 常见错误怎么处理
- `docs/iphone-guide.md`：用 Safari 打开 → 分享 → 添加到主屏幕 → 从主屏幕打开 → 设置里开启通知 → 定期导出备份；写明需要 iOS 16.4 及以上，以及 iPhone 通知上没有按钮、要点开通知
- `scripts/screenshots.ts`：用 Playwright 在 iPhone 14 尺寸下，造好演示数据，截 6 张图（大厅、选择卡、冒险中、结算、档案、商店），中文和英文各一套，存到 `docs/screenshots/`
- README：一句话介绍、为什么做（两个问题）、截图、功能列表、技术架构图（文字或 mermaid）、本地运行（`pnpm install`、`pnpm dev`、`pnpm test`、`pnpm --filter @lazy-guild/web e2e`）、部署链接、许可证；两份 README 顶部互相链接

- [ ] **Step 1: 写 deploy.yml，然后 `pnpm dlx @action-validator/cli .github/workflows/deploy.yml`**（或者用 actionlint）→ 没有错误
- [ ] **Step 2: 运行 `pnpm screenshots`** → `docs/screenshots/` 里有 12 张图，逐张打开看一遍
- [ ] **Step 3: 写两份 README 和两份文档**
- [ ] **Step 4: 全量验证**：`pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @lazy-guild/web e2e && pnpm --filter @lazy-guild/web build` → 全部通过
- [ ] **Step 5: 提交** `docs: deployment, iPhone guide, screenshots and bilingual README`

---

## 收尾

- 全部任务完成后，对整个分支做一次代码审查（重点看 Review Focus 的 5 条和 Global Constraints）
- 使用 superpowers:finishing-a-development-branch：把 `feat/lazy-guild-v1` 合并到 main 并推送，然后告诉用户按 `docs/deploy.md` 配置 Cloudflare
