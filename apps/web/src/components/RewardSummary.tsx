import { useTranslation } from 'react-i18next';
import type { SettleResult } from '../services/guild';

export function RewardSummary({ result }: { result: SettleResult }) {
  const { t } = useTranslation();
  const { reward, delta, newBadges, milestoneGold, unlocked } = result;
  if (reward.xp === 0 && reward.gold === 0 && milestoneGold === 0) {
    return <p className="card muted">{t('reward.nothing')}</p>;
  }
  return (
    <div className="card stack reward">
      <div className="row wrap reward-numbers">
        <span className="reward-pill">
          <b>+{reward.xp}</b> {t('reward.xp')}
        </span>
        <span className="reward-pill">
          <b>+{reward.gold}</b> {t('reward.gold')}
        </span>
        {reward.statPoints > 0 && (
          <span className={`reward-pill stat-${reward.stat}`}>
            <span className="badge-stat">{t(`stat.${reward.stat}`)}</span> <b>+{reward.statPoints}</b>
          </span>
        )}
      </div>
      {delta.levelAfter > delta.levelBefore && <p className="celebrate">{t('reward.levelUp', { level: delta.levelAfter })}</p>}
      {delta.rankAfter !== delta.rankBefore && <p className="celebrate">{t('reward.rankUp', { rank: delta.rankAfter })}</p>}
      {delta.stageAfter !== delta.stageBefore && (
        <p className="celebrate evolve">{t('reward.evolve', { stage: t(`stage.${delta.stageAfter}`) })}</p>
      )}
      {milestoneGold > 0 && <p>{t('reward.milestone', { gold: milestoneGold })}</p>}
      {newBadges.map((b) => (
        <p key={b}>🏅 {t('reward.badge', { name: t(`badges.${b}.name`) })}</p>
      ))}
      {unlocked.length > 0 && (
        <p>🛒 {t('reward.unlocked', { names: unlocked.map((i) => t(`shop.items.${i.id}`)).join(', ') })}</p>
      )}
    </div>
  );
}
