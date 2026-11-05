import type { SlotError } from '@lazy-guild/core';
import { SLOT_CANDIDATES_MAX, SLOT_CANDIDATES_MIN } from '@lazy-guild/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { db } from '../db';
import { removeSlot, saveSlot } from '../services/plan';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
type Draft = { id?: string; weekdays: number[]; time: string; questIds: string[] };

export default function Plan() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState<Draft | null>(() =>
    params.get('new') ? { weekdays: [], time: '19:00', questIds: [] } : null,
  );
  const data = useLiveQuery(async () => ({ slots: await db.slots.toArray(), quests: await db.quests.toArray() }), []);
  if (!data) return null;
  const weekdayNames = t('weekdays', { returnObjects: true }) as string[];
  const questName = (id: string) => data.quests.find((q) => q.id === id);
  const close = () => {
    setDraft(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

  return (
    <section className="page">
      <h1>{t('plan.title')}</h1>
      <p className="muted">{t('plan.hint')}</p>
      {!draft && (
        <button className="btn primary block" type="button" onClick={() => setDraft({ weekdays: [], time: '19:00', questIds: [] })}>
          <span aria-hidden="true">＋</span> {t('plan.add')}
        </button>
      )}
      {draft && <SlotForm draft={draft} quests={data.quests} onDone={close} />}

      {WEEK_ORDER.map((day) => {
        const slots = data.slots.filter((s) => s.weekdays.includes(day)).sort((a, b) => a.time.localeCompare(b.time));
        return (
          <div key={day} className="card stack day-card">
            <h2>{weekdayNames[day]}</h2>
            {slots.length === 0 && <p className="muted small">{t('plan.empty')}</p>}
            {slots.map((s) => {
              const active = s.questIds.map(questName).filter((q) => q && !q.archived);
              return (
                <button
                  key={s.id}
                  type="button"
                  className="slot-row"
                  onClick={() => setDraft({ id: s.id, weekdays: s.weekdays, time: s.time, questIds: s.questIds })}
                >
                  <span className="slot-time">{s.time}</span>
                  <span className="slot-cands">
                    {active.map((q) => (
                      <span key={q!.id}>
                        <span aria-hidden="true">{q!.icon}</span> {q!.name}
                      </span>
                    ))}
                  </span>
                  {active.length < SLOT_CANDIDATES_MIN && <span className="error small">{t('plan.needsCandidates')}</span>}
                </button>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}

function SlotForm({
  draft,
  quests,
  onDone,
}: {
  draft: Draft;
  quests: { id: string; name: string; icon: string; archived: boolean }[];
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [d, setD] = useState(draft);
  const [error, setError] = useState<SlotError | null>(null);
  const weekdayNames = t('weekdays', { returnObjects: true }) as string[];
  const available = quests.filter((q) => !q.archived);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  if (available.length < SLOT_CANDIDATES_MIN)
    return (
      <div className="card stack">
        <p>{t('plan.noQuests')}</p>
        <Link className="btn primary" to="/quests">
          {t('choose.toLibrary')}
        </Link>
      </div>
    );

  return (
    <form
      noValidate
      className="card stack"
      aria-label={t('plan.form')}
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await saveSlot({ ...d, questIds: d.questIds.filter((id) => available.some((q) => q.id === id)) });
        if (res.ok) onDone();
        else setError(res.error);
      }}
    >
      <fieldset className="field plain">
        <legend>{t('plan.days')}</legend>
        <div className="row wrap">
          {WEEK_ORDER.map((day) => (
            <button
              key={day}
              type="button"
              className={d.weekdays.includes(day) ? 'chip on' : 'chip'}
              aria-pressed={d.weekdays.includes(day)}
              onClick={() => setD({ ...d, weekdays: toggle(d.weekdays, day) })}
            >
              {weekdayNames[day]}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="field">
        <span>{t('plan.time')}</span>
        <input className="input" type="time" value={d.time} onChange={(e) => setD({ ...d, time: e.target.value })} />
      </label>
      <fieldset className="field plain">
        <legend>{t('plan.candidates')}</legend>
        <div className="stack tight">
          {available.map((q) => {
            const checked = d.questIds.includes(q.id);
            return (
              <label key={q.id} className="check">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && d.questIds.length >= SLOT_CANDIDATES_MAX}
                  onChange={() => setD({ ...d, questIds: toggle(d.questIds, q.id) })}
                />
                <span aria-hidden="true">{q.icon}</span>
                <span>{q.name}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {error && <p className="error">{t(`plan.errors.${error}`)}</p>}
      <div className="row">
        <button className="btn primary" type="submit">
          {t('common.save')}
        </button>
        <button className="btn" type="button" onClick={onDone}>
          {t('common.cancel')}
        </button>
        {d.id && (
          <button
            className="btn danger"
            type="button"
            onClick={async () => {
              await removeSlot(d.id!);
              onDone();
            }}
          >
            {t('common.delete')}
          </button>
        )}
      </div>
    </form>
  );
}
