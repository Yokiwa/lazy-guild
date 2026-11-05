import type { Lang } from '@lazy-guild/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db, kvGet, kvSet } from '../db';
import { currentLang, setLang } from '../i18n';
import { pushClient, type PushStatus } from '../push/client';
import { backupFileName, downloadBlob, exportBackupFile, importBackupText } from '../services/backup';

export default function Settings() {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const profile = useLiveQuery(() => db.profile.get('me'), []);
  const reminderOff = useLiveQuery(async () => (await kvGet<boolean>('backupReminderOff')) ?? false, []);
  useEffect(() => {
    void pushClient.status().then(setStatus);
  }, []);
  const lang = currentLang();

  return (
    <section className="page">
      <h1>{t('settings.title')}</h1>

      <div className="card stack">
        <h2>{t('settings.language')}</h2>
        <div className="row">
          {(['zh', 'en'] as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              className={lang === l ? 'chip on' : 'chip'}
              aria-pressed={lang === l}
              onClick={() => setLang(l)}
            >
              {l === 'zh' ? '中文' : 'English'}
            </button>
          ))}
        </div>
      </div>

      <div className="card stack">
        <h2>{t('settings.notifications')}</h2>
        {status && <p className="muted">{t(`settings.status.${status}`)}</p>}
        {(status === 'off' || status === 'denied') && (
          <button className="btn gold" type="button" onClick={async () => setStatus(await pushClient.enable())}>
            {t('settings.enable')}
          </button>
        )}
        {(status === 'synced' || status === 'pending') && (
          <button
            className="btn"
            type="button"
            onClick={async () => {
              await pushClient.disable();
              setStatus(await pushClient.status());
            }}
          >
            {t('settings.disable')}
          </button>
        )}
      </div>

      <div className="card stack">
        <h2>{t('settings.backup')}</h2>
        <p className="muted small">{t('settings.backupHint')}</p>
        <p className="small">
          {t('settings.lastBackup', {
            date: profile?.lastBackupAt ? new Date(profile.lastBackupAt).toLocaleString() : t('settings.never'),
          })}
        </p>
        <button
          className="btn primary"
          type="button"
          onClick={async () => downloadBlob(await exportBackupFile(), backupFileName())}
        >
          {t('settings.export')}
        </button>
        <label className="btn file-btn">
          {t('settings.import')}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file || !window.confirm(t('settings.importConfirm'))) return;
              const res = await importBackupText(await file.text());
              setMessage(
                res.ok ? { ok: true, text: t('settings.importOk') } : { ok: false, text: t(`settings.importErrors.${res.error}`) },
              );
            }}
          />
        </label>
        {message && (
          <p className={message.ok ? 'small' : 'error'} role="status">
            {message.text}
          </p>
        )}
        <label className="check">
          <input type="checkbox" checked={!!reminderOff} onChange={(e) => kvSet('backupReminderOff', e.target.checked)} />
          <span>{t('settings.reminderOff')}</span>
        </label>
      </div>

      <div className="card stack">
        <h2>{t('settings.about')}</h2>
        <p className="muted small">{t('settings.aboutText')}</p>
        <a className="btn" href="https://github.com/Yokiwa/lazy-guild" target="_blank" rel="noreferrer">
          {t('settings.source')}
        </a>
      </div>
    </section>
  );
}
