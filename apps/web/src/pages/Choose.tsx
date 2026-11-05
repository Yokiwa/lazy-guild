import { type Quest, findOccurrence, isQuick } from '@lazy-guild/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { QuestCard } from '../components/QuestCard';
import { db } from '../db';
import { now } from '../lib/clock';
import { acceptQuest } from '../services/guild';

export default function Choose() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const slotId = params.get('slot');
  const date = params.get('date');
  const [conflict, setConflict] = useState<Quest | null>(null);
  const [busy, setBusy] = useState(false);

  const data = useLiveQuery(async () => {
    const [slots, quests] = await Promise.all([db.slots.toArray(), db.quests.toArray()]);
    return { slots, quests };
  }, []);
  if (!data) return null;

  const t0 = now();
  const fromSlot = Boolean(slotId && date);
  const occ = fromSlot ? findOccurrence(data.slots, slotId!, date!) : null;
  const open = occ && t0 >= occ.start && t0 < occ.end;
  const active = data.quests.filter((q) => !q.archived);

  if (fromSlot && !open) {
    return (
      <section className="page">
        <h1>{t('choose.expired')}</h1>
        <p className="muted">{t('choose.expiredHint')}</p>
        <Link className="btn primary block" to="/choose">
          {t('choose.toFree')}
        </Link>
        <Link className="btn block" to="/">
          {t('confirm.toHall')}
        </Link>
      </section>
    );
  }

  const slot = occ ? data.slots.find((s) => s.id === occ.slotId) : undefined;
  const candidates = slot
    ? slot.questIds.map((id) => active.find((q) => q.id === id)).filter((q): q is Quest => !!q)
    : active;

  const pick = async (quest: Quest, replaceActive = false) => {
    if (busy) return;
    setBusy(true);
    const res = await acceptQuest({ questId: quest.id, slotId: occ?.slotId ?? null, date: occ?.date ?? null, replaceActive });
    setBusy(false);
    if (res.ok) navigate('/run', { replace: true });
    else if (res.reason === 'active_exists') setConflict(quest);
  };

  return (
    <section className="page">
      <h1>{fromSlot ? t('choose.title') : t('choose.freeTitle')}</h1>
      <p className="muted">{fromSlot ? t('choose.subtitle') : t('choose.freeSubtitle')}</p>
      {occ && isQuick(occ, t0) && <p className="card quick-hint">
          <span aria-hidden="true">⚡</span> <span>{t('choose.quickHint')}</span>
        </p>}
      {candidates.length === 0 ? (
        <div className="card stack">
          <p>{t('choose.empty')}</p>
          <Link className="btn primary" to="/quests">
            {t('choose.toLibrary')}
          </Link>
        </div>
      ) : (
        <div className="stack">
          {candidates.map((q) => (
            <QuestCard key={q.id} quest={q} onPick={() => pick(q)} disabled={busy} />
          ))}
        </div>
      )}
      <Link className="btn ghost block" to="/">
        {t('common.back')}
      </Link>
      {conflict && (
        <Modal title={t('choose.conflictTitle')} onClose={() => setConflict(null)}>
          <div className="stack">
            <Link className="btn primary block" to="/run">
              {t('choose.keepCurrent')}
            </Link>
            <button className="btn danger block" type="button" onClick={() => pick(conflict, true)}>
              {t('choose.replace')}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
