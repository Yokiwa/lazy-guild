import { BACKUP_REMINDER_DAYS, addDays, localDate } from '@lazy-guild/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { CompanionBubble } from '../components/CompanionBubble';
import { kvGet } from '../db';
import { pickLine } from '../content/lines';
import { formatClock } from '../lib/format';
import { useNow } from '../lib/useNow';
import { pushClient, type PushStatus } from '../push/client';
import { guildSummary } from '../services/guild';

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default function Hall() {
  const { t } = useTranslation();
  const now = useNow(1000);
  const minute = Math.floor(now.getTime() / 60_000);
  const s = useLiveQuery(() => guildSummary(), [minute]);
  const reminderOff = useLiveQuery(async () => (await kvGet<boolean>('backupReminderOff')) ?? false, []);
  const [push, setPush] = useState<PushStatus | null>(null);
  useEffect(() => {
    void pushClient.status().then(setPush);
  }, []);
  const yesterdayRested = s?.streak.restDays.at(-1);
  const line = useMemo(
    () => (s ? pickLine(t, s.profile.species, yesterdayRested && yesterdayRested === addDays(localDate(now), -1) ? 'rest' : 'greet') : ''),
    [s?.profile.species, yesterdayRested, t],
  );

  if (!s) return null;
  if (s.activeRun && now.getTime() >= Date.parse(s.activeRun.endsAt))
    return <Navigate to={`/confirm?run=${s.activeRun.id}`} replace />;

  const { profile } = s;
  const lastBackup = Date.parse(profile.lastBackupAt ?? profile.createdAt);
  const needsBackup = !reminderOff && now.getTime() - lastBackup > BACKUP_REMINDER_DAYS * 86_400_000;
  const pct = s.xpForNext === Infinity ? 100 : Math.round((s.xpIntoLevel / s.xpForNext) * 100);

  return (
    <section className="page hall">
      <CompanionBubble species={profile.species} stage={s.stage} equipped={profile.equipped} line={line} />

      <div className="card stack">
        <div className="row between">
          <div>
            <h1 className="hero-name">
              {profile.name}
              {profile.equipped.title && <small className="title-tag">{t(`shop.items.${profile.equipped.title}`)}</small>}
            </h1>
            <p className="muted">{t('hall.rank', { rank: s.rank })}</p>
          </div>
          <strong className="level">{t('hall.level', { level: s.level })}</strong>
        </div>
        <div className="bar" aria-hidden="true">
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="row between wrap muted small">
          <span>
            {s.xpForNext === Infinity ? t('hall.maxLevel') : t('hall.xp', { into: s.xpIntoLevel, next: s.xpForNext })}
          </span>
          <span><span aria-hidden="true">🪙</span> {t('hall.gold', { count: profile.gold })}</span>
        </div>
        <div className="row between wrap small">
          <span><span aria-hidden="true">🔥</span> {t('hall.streak', { count: s.streak.current })}</span>
          <span><span aria-hidden="true">🛏️</span> {t('hall.tokens', { count: s.streak.tokens })}</span>
        </div>
      </div>

      {needsBackup && (
        <div className="card warn row between">
          <span>{t('hall.backupReminder')}</span>
          <Link className="btn" to="/settings">
            {t('hall.backupGo')}
          </Link>
        </div>
      )}
      {(push === 'off' || push === 'denied') && (
        <div className="card warn row between">
          <span>{t('hall.notifyOff')}</span>
          <Link className="btn" to="/settings">
            {t('hall.notifyGo')}
          </Link>
        </div>
      )}

      {s.activeRun && s.activeQuest && (
        <Link to="/run" className="card active-run">
          <span className="muted small">{t('hall.activeTitle')}</span>
          <strong>
            {s.activeQuest.icon} {s.activeQuest.name}
          </strong>
          <span>{t('hall.remaining', { time: formatClock(Date.parse(s.activeRun.endsAt) - now.getTime()) })}</span>
        </Link>
      )}

      <div className="card stack">
        <h2>{t('hall.today')}</h2>
        {s.today.length === 0 && <p className="muted">{t('hall.noSlotsToday')}</p>}
        <ul className="slot-list">
          {s.today.map((o) => {
            const state = now < o.start ? 'upcoming' : now < o.end ? 'open' : 'passed';
            return (
              <li key={o.slotId} className={`slot-item ${state}`}>
                <span className="slot-time">{hhmm(o.start)}</span>
                <span className="muted small">
                  {t(`hall.slot${state[0]!.toUpperCase()}${state.slice(1)}`)}
                </span>
                {state === 'open' && !s.activeRun && (
                  <Link className="btn gold" to={`/choose?slot=${o.slotId}&date=${o.date}`}>
                    {t('hall.pickNow')}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <Link className="btn primary block big" to="/choose">
        {t('hall.freeQuest')}
      </Link>
      <Link className="btn block" to="/shop">
        <span aria-hidden="true">🛒</span> {t('hall.shop')}
      </Link>
    </section>
  );
}

