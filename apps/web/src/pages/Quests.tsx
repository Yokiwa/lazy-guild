import type { Quest, Stat } from '@lazy-guild/core';
import { QUEST_MINUTES_MAX, QUEST_MINUTES_MIN } from '@lazy-guild/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../db';
import { formatMinutes } from '../lib/format';
import { removeQuest, saveQuest } from '../services/plan';

const STATS: Stat[] = ['STR', 'INT', 'SKL'];
const ICONS = ['💪', '🏃', '📚', '✏️', '🧮', '🗣️', '🎌', '🛠️', '💻', '🎨', '🎸', '🧹'];
type Draft = { id?: string; name: string; stat: Stat; minutes: number; icon: string };

export default function Quests() {
  const { t } = useTranslation();
  const quests = useLiveQuery(() => db.quests.toArray(), []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  if (!quests) return null;

  return (
    <section className="page">
      <h1>{t('quests.title')}</h1>
      <p className="muted">{t('quests.hint')}</p>
      {notice && (
        <p className="card warn" role="status">
          {notice}
        </p>
      )}
      {!draft && (
        <button
          className="btn primary block"
          type="button"
          onClick={() => setDraft({ name: '', stat: 'INT', minutes: 60, icon: ICONS[2]! })}
        >
          <span aria-hidden="true">＋</span> {t('quests.add')}
        </button>
      )}
      {draft && (
        <QuestForm
          draft={draft}
          onDone={(msg) => {
            setDraft(null);
            setNotice(msg ?? null);
          }}
        />
      )}
      <ul className="stack plain-list">
        {quests
          .filter((q) => !q.archived)
          .map((q: Quest) => (
            <li key={q.id} className={`card row between stat-${q.stat}`}>
              <span className="row">
                <span className="quest-icon" aria-hidden="true">
                  {q.icon}
                </span>
                <span className="stack tight">
                  <strong>{q.name}</strong>
                  <span className="muted small">
                    <span className="badge-stat">{t(`stat.${q.stat}`)}</span> {formatMinutes(t, q.minutes)}
                  </span>
                </span>
              </span>
              <button
                className="btn"
                type="button"
                aria-label={t('quests.editLabel', { name: q.name })}
                onClick={() => {
                  setNotice(null);
                  setDraft({ id: q.id, name: q.name, stat: q.stat, minutes: q.minutes, icon: q.icon });
                }}
              >
                {t('common.edit')}
              </button>
            </li>
          ))}
      </ul>
    </section>
  );
}

function QuestForm({ draft, onDone }: { draft: Draft; onDone: (notice?: string) => void }) {
  const { t } = useTranslation();
  const [d, setD] = useState(draft);
  const [minutesText, setMinutesText] = useState(String(draft.minutes));
  const [error, setError] = useState<'name' | 'minutes' | null>(null);
  return (
    <form
      noValidate
      className="card stack"
      aria-label={t('quests.form')}
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await saveQuest({ ...d, minutes: Number(minutesText) });
        if (res.ok) onDone();
        else setError(res.error);
      }}
    >
      <label className="field">
        <span>{t('quests.name')}</span>
        <input className="input" value={d.name} maxLength={40} onChange={(e) => setD({ ...d, name: e.target.value })} />
      </label>
      <fieldset className="field plain">
        <legend>{t('quests.stat')}</legend>
        <div className="row wrap">
          {STATS.map((s) => (
            <button
              key={s}
              type="button"
              className={d.stat === s ? `chip on stat-${s}` : `chip stat-${s}`}
              aria-pressed={d.stat === s}
              onClick={() => setD({ ...d, stat: s })}
            >
              {t(`stat.${s}`)}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="field">
        <span>{t('quests.minutes')}</span>
        <input
          className="input"
          type="number"
          inputMode="numeric"
          min={QUEST_MINUTES_MIN}
          max={QUEST_MINUTES_MAX}
          value={minutesText}
          onChange={(e) => setMinutesText(e.target.value)}
        />
      </label>
      <div className="row wrap">
        {[30, 60, 90, 120].map((m) => (
          <button key={m} type="button" className="chip" onClick={() => setMinutesText(String(m))}>
            {formatMinutes(t, m)}
          </button>
        ))}
      </div>
      <fieldset className="field plain">
        <legend>{t('quests.icon')}</legend>
        <div className="icon-grid">
          {ICONS.map((i) => (
            <button
              key={i}
              type="button"
              className={d.icon === i ? 'chip on' : 'chip'}
              aria-pressed={d.icon === i}
              onClick={() => setD({ ...d, icon: i })}
            >
              {i}
            </button>
          ))}
        </div>
      </fieldset>
      {error && <p className="error">{t(`quests.errors.${error}`)}</p>}
      <div className="row">
        <button className="btn primary" type="submit">
          {t('common.save')}
        </button>
        <button className="btn" type="button" onClick={() => onDone()}>
          {t('common.cancel')}
        </button>
        {d.id && (
          <button
            className="btn danger"
            type="button"
            onClick={async () => {
              const result = await removeQuest(d.id!);
              onDone(t(result === 'archived' ? 'quests.archived' : 'quests.deleted', { name: draft.name }));
            }}
          >
            {t('common.delete')}
          </button>
        )}
      </div>
    </form>
  );
}
