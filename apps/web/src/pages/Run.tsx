import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { CompanionBubble } from '../components/CompanionBubble';
import { Modal } from '../components/Modal';
import { pickLine } from '../content/lines';
import { db } from '../db';
import { formatClock, formatMinutes } from '../lib/format';
import { useNow } from '../lib/useNow';
import { abandonRun, guildSummary } from '../services/guild';

export default function Run() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const now = useNow(1000);
  const s = useLiveQuery(() => guildSummary(), []);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const species = s?.profile.species;
  const line = useMemo(() => (species ? pickLine(t, species, 'accept') : ''), [species, t]);
  const quest = useLiveQuery(async () => (s?.activeRun ? await db.quests.get(s.activeRun.questId) : null), [s?.activeRun?.id]);

  if (!s) return null;
  const run = s.activeRun;
  if (!run) {
    return (
      <section className="page">
        <h1>{t('run.none')}</h1>
        <Link className="btn primary block" to="/">
          {t('confirm.toHall')}
        </Link>
      </section>
    );
  }
  const left = Date.parse(run.endsAt) - now.getTime();
  const total = run.plannedMinutes * 60_000;
  const pct = Math.min(100, Math.max(0, Math.round(((total - left) / total) * 100)));

  return (
    <section className="page run">
      <h1>{t('run.title')}</h1>
      <CompanionBubble species={s.profile.species} stage={s.stage} equipped={s.profile.equipped} line={line} />
      <div className="card stack center">
        <strong className="run-quest">
          {quest?.icon} {quest?.name}
        </strong>
        <span className="muted">{formatMinutes(t, run.plannedMinutes)}</span>
        {run.quick && <span className="quick-hint small"><span aria-hidden="true">⚡</span> {t('run.quick')}</span>}
        <div className="countdown" aria-live="off">
          {left > 0 ? formatClock(left) : t('run.timeUp')}
        </div>
        <div className="bar" aria-hidden="true">
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>
      <button className="btn primary block big" type="button" onClick={() => navigate(`/confirm?run=${run.id}`)}>
        {left > 0 ? t('run.finishEarly') : t('run.report')}
      </button>
      <button className="btn ghost block" type="button" onClick={() => setConfirmAbandon(true)}>
        {t('run.abandon')}
      </button>
      <Link className="btn ghost block" to="/">
        {t('confirm.toHall')}
      </Link>
      {confirmAbandon && (
        <Modal title={t('run.abandon')} onClose={() => setConfirmAbandon(false)}>
          <p>{t('run.abandonConfirm')}</p>
          <div className="row">
            <button className="btn" type="button" onClick={() => setConfirmAbandon(false)}>
              {t('common.cancel')}
            </button>
            <button
              className="btn danger"
              type="button"
              onClick={async () => {
                await abandonRun(run.id);
                navigate('/', { replace: true });
              }}
            >
              {t('run.abandon')}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
