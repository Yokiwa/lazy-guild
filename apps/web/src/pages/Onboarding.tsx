import type { Species } from '@lazy-guild/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { Companion } from '../art/Companion';
import { useLayoutProfile } from '../components/Layout';
import { currentLang } from '../i18n';
import { pushClient } from '../push/client';
import { createProfile } from '../services/guild';

const SPECIES: Species[] = ['slime', 'foxfire', 'drake'];

export default function Onboarding() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<Species | null>(null);
  const [nameError, setNameError] = useState(false);
  const [busy, setBusy] = useState(false);
  const profile = useLayoutProfile();

  const finish = async (enableNotify: boolean) => {
    if (!species || busy) return;
    setBusy(true);
    await createProfile(name, species, currentLang());
    if (enableNotify) await pushClient.enable();
  };

  // Navigate only once the Layout itself sees the profile; otherwise it would bounce us back here.
  if (profile) return <Navigate to={busy ? '/plan?new=1' : '/'} replace />;

  return (
    <section className="page onboarding">
      <h1>{t('onboarding.welcome')}</h1>
      <p className="muted">{t('onboarding.pitch')}</p>

      {step === 0 && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            const len = [...name.trim()].length;
            if (len < 1 || len > 20) return setNameError(true);
            setStep(1);
          }}
        >
          <label className="field">
            <span>{t('onboarding.nameLabel')}</span>
            <input
              className="input"
              value={name}
              maxLength={20}
              placeholder={t('onboarding.namePlaceholder')}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(false);
              }}
            />
          </label>
          {nameError && <p className="error">{t('onboarding.nameError')}</p>}
          <button className="btn primary block" type="submit">
            {t('onboarding.next')}
          </button>
        </form>
      )}

      {step === 1 && (
        <div className="stack">
          <h2>{t('onboarding.pickCompanion')}</h2>
          <p className="muted">{t('onboarding.companionHint')}</p>
          <div className="species-grid">
            {SPECIES.map((s) => (
              <button
                key={s}
                type="button"
                className={species === s ? 'species-option on' : 'species-option'}
                aria-pressed={species === s}
                onClick={() => setSpecies(s)}
              >
                <Companion species={s} stage="baby" size={88} label={t(`species.${s}`)} />
                <span>{t(`species.${s}`)}</span>
              </button>
            ))}
          </div>
          <button className="btn primary block" type="button" disabled={!species} onClick={() => setStep(2)}>
            {t('onboarding.next')}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="stack">
          <h2>{t('onboarding.notifyTitle')}</h2>
          <ol className="steps">
            {(t('onboarding.notifySteps', { returnObjects: true }) as string[]).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <button className="btn gold block" type="button" disabled={busy} onClick={() => finish(true)}>
            {t('onboarding.enableNotify')}
          </button>
          <button className="btn ghost block" type="button" disabled={busy} onClick={() => finish(false)}>
            {t('onboarding.skip')}
          </button>
        </div>
      )}
    </section>
  );
}
