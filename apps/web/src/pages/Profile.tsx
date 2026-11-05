import { BADGE_IDS, localDate } from '@lazy-guild/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { CompanionBubble } from '../components/CompanionBubble';
import { db } from '../db';
import { formatMinutes } from '../lib/format';
import { guildSummary } from '../services/guild';

export default function Profile() {
  const { t } = useTranslation();
  const data = useLiveQuery(async () => {
    const s = await guildSummary();
    const [runs, quests] = await Promise.all([db.runs.toArray(), db.quests.toArray()]);
    return { s, runs, quests };
  }, []);
  if (!data?.s) return null;
  const { s, runs, quests } = data;
  const { profile } = s;
  const maxStat = Math.max(10, profile.stats.STR, profile.stats.INT, profile.stats.SKL);
  const log = runs
    .filter((r) => r.status === 'done' || r.status === 'partial')
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const days = [...new Set(log.map((r) => localDate(new Date(r.startedAt))))];

  return (
    <section className="page">
      <h1>{t('profile.title')}</h1>
      <CompanionBubble species={profile.species} stage={s.stage} equipped={profile.equipped} scene={false} size={120} />
      <div className="card stack">
        <div className="row between">
          <strong>{profile.name}</strong>
          <span>
            {t('hall.level', { level: s.level })} · {t('hall.rank', { rank: s.rank })}
          </span>
        </div>
        <p className="muted small">
          {t('hall.streak', { count: s.streak.current })} · {t('profile.best', { count: s.streak.best })}
        </p>
      </div>

      <div className="card stack">
        <h2>{t('profile.stats')}</h2>
        {(['STR', 'INT', 'SKL'] as const).map((k) => (
          <div key={k} className={`stack tight stat-${k}`}>
            <div className="row between small">
              <span className="badge-stat">{t(`stat.${k}`)}</span>
              <strong>{profile.stats[k]}</strong>
            </div>
            <div className="bar" aria-hidden="true">
              <i style={{ width: `${Math.round((profile.stats[k] / maxStat) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="card stack">
        <h2>{t('profile.badges')}</h2>
        <ul className="badge-grid plain-list">
          {BADGE_IDS.map((b) => {
            const have = profile.badges.includes(b);
            return (
              <li key={b} className={have ? 'badge on' : 'badge'} title={t(`badges.${b}.how`)}>
                <span aria-hidden="true">{have ? '🏅' : '🔒'}</span>
                <strong>{t(`badges.${b}.name`)}</strong>
                <span className="muted small">{t(`badges.${b}.how`)}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="card stack">
        <h2>{t('profile.log')}</h2>
        {log.length === 0 && <p className="muted">{t('profile.logEmpty')}</p>}
        <ul className="plain-list stack" aria-label={t('profile.log')}>
          {days.map((day) =>
            log
              .filter((r) => localDate(new Date(r.startedAt)) === day)
              .map((r, i) => {
                const q = quests.find((x) => x.id === r.questId);
                return (
                  <li key={r.id} className="log-item">
                    {i === 0 && <span className="log-day muted small">{day}</span>}
                    <span className="row between">
                      <span>
                        <span aria-hidden="true">{q?.icon}</span> {q?.name}{' '}
                        {r.status === 'partial' && <em className="muted small">({t('profile.partialTag')})</em>}
                      </span>
                      <span className="muted small">
                        {formatMinutes(t, r.plannedMinutes)} · +{r.reward?.xp ?? 0} {t('reward.xp')}
                      </span>
                    </span>
                  </li>
                );
              }),
          )}
        </ul>
      </div>
    </section>
  );
}
