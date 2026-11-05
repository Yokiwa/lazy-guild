import type { Quest } from '@lazy-guild/core';
import { useTranslation } from 'react-i18next';
import { formatMinutes } from '../lib/format';

export function QuestCard({ quest, onPick, disabled }: { quest: Quest; onPick: () => void; disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <button type="button" className={`quest-card stat-${quest.stat}`} onClick={onPick} disabled={disabled}>
      <span className="quest-icon" aria-hidden="true">
        {quest.icon}
      </span>
      <span className="quest-text">
        <strong>{quest.name}</strong>
        <span className="muted">
          <span className="badge-stat">{t(`stat.${quest.stat}`)}</span> {formatMinutes(t, quest.minutes)}
        </span>
      </span>
    </button>
  );
}
