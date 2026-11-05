import type { Outcome, Run } from '@lazy-guild/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { CompanionBubble } from '../components/CompanionBubble';
import { RewardSummary } from '../components/RewardSummary';
import { type Occasion, pickLine } from '../content/lines';
import { db } from '../db';
import { type SettleResult, guildSummary, settleRun } from '../services/guild';

export default function Confirm() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [result, setResult] = useState<{ res: SettleResult; line: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const data = useLiveQuery(async () => {
    const s = await guildSummary();
    const id = params.get('run') ?? s?.activeRun?.id;
    const run: Run | null = id ? ((await db.runs.get(id)) ?? null) : null;
    const quest = run ? await db.quests.get(run.questId) : undefined;
    return { s, run, quest };
  }, [params]);

  if (!data?.s) return null;
  const { s, run, quest } = data;

  if (result) {
    const stage = result.res.delta.stageAfter;
    return (
      <section className="page">
        <h1>{t('confirm.resultTitle')}</h1>
        <CompanionBubble species={s.profile.species} stage={stage} equipped={s.profile.equipped} line={result.line} />
        <RewardSummary result={result.res} />
        <Link className="btn primary block big" to="/">
          {t('confirm.toHall')}
        </Link>
      </section>
    );
  }

  if (!run || run.status !== 'active') {
    return (
      <section className="page">
        <h1>{t('confirm.alreadySettled')}</h1>
        <Link className="btn primary block" to="/">
          {t('confirm.toHall')}
        </Link>
      </section>
    );
  }

  const settle = async (outcome: Outcome) => {
    if (busy) return;
    setBusy(true);
    const res = await settleRun(run.id, outcome);
    if (!res) return setBusy(false);
    const occasion: Occasion =
      res.delta.stageAfter !== res.delta.stageBefore
        ? 'evolve'
        : res.delta.levelAfter > res.delta.levelBefore
          ? 'levelUp'
          : outcome;
    setResult({ res, line: pickLine(t, s.profile.species, occasion) });
  };

  return (
    <section className="page">
      <h1>{t('confirm.title')}</h1>
      <p className="card run-quest center">
        {quest?.icon} {quest?.name}
      </p>
      <div className="stack">
        <button className="btn primary block big" type="button" disabled={busy} onClick={() => settle('done')}>
          <span aria-hidden="true">✅</span> {t('confirm.done')}
        </button>
        <button className="btn gold block big" type="button" disabled={busy} onClick={() => settle('partial')}>
          <span aria-hidden="true">🌗</span> {t('confirm.partial')}
        </button>
        <button className="btn block big" type="button" disabled={busy} onClick={() => settle('skipped')}>
          <span aria-hidden="true">💤</span> {t('confirm.skipped')}
        </button>
      </div>
    </section>
  );
}
