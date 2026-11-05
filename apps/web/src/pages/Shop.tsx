import { type Equipped, type ShopItem, type ShopKind, SHOP_ITEMS, checkBuy } from '@lazy-guild/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CompanionBubble } from '../components/CompanionBubble';
import { buyItem, equip, guildSummary } from '../services/guild';

const KINDS: ShopKind[] = ['hat', 'cape', 'background', 'title', 'rest_token'];

export default function Shop() {
  const { t } = useTranslation();
  const s = useLiveQuery(() => guildSummary(), []);
  const [flash, setFlash] = useState<string | null>(null);
  if (!s) return null;
  const { profile } = s;

  const card = (item: ShopItem) => {
    const name = t(`shop.items.${item.id}`);
    const check = checkBuy(item, { gold: profile.gold, rank: s.rank, owned: profile.owned, tokens: s.streak.tokens });
    const owned = item.kind !== 'rest_token' && profile.owned.includes(item.id);
    const slot = item.kind as keyof Equipped;
    const equipped = !owned ? false : profile.equipped[slot] === item.id;
    return (
      <article key={item.id} className="card shop-item" aria-label={name}>
        <div className="row between">
          <strong>{name}</strong>
          <span className="muted small">🪙 {item.price}</span>
        </div>
        {item.kind === 'rest_token' && <p className="muted small">{t('hall.tokens', { count: s.streak.tokens })}</p>}
        {owned ? (
          <button
            className={equipped ? 'btn' : 'btn primary'}
            type="button"
            onClick={() => equip(slot, equipped ? null : item.id)}
          >
            {equipped ? t('shop.unequip') : t('shop.equip')}
          </button>
        ) : (
          <>
            <button
              className="btn gold"
              type="button"
              disabled={check !== 'ok'}
              onClick={async () => {
                if ((await buyItem(item.id)) === 'ok') setFlash(t('shop.bought'));
              }}
            >
              {t('shop.buy', { price: item.price })}
            </button>
            {check !== 'ok' && check !== 'owned' && (
              <span className="muted small">{t(`shop.reasons.${check}`, { rank: item.minRank })}</span>
            )}
          </>
        )}
      </article>
    );
  };

  return (
    <section className="page">
      <div className="row between">
        <h1>{t('shop.title')}</h1>
        <Link className="btn ghost" to="/">
          {t('common.back')}
        </Link>
      </div>
      <CompanionBubble species={profile.species} stage={s.stage} equipped={profile.equipped} line={flash ?? undefined} />
      <p className="card">
        <span aria-hidden="true">🪙</span> {t('shop.balance', { count: profile.gold })}
      </p>
      {KINDS.map((kind) => (
        <div key={kind} className="stack">
          <h2>{t(`shop.kinds.${kind}`)}</h2>
          <div className="shop-grid">{SHOP_ITEMS.filter((i) => i.kind === kind).map(card)}</div>
        </div>
      ))}
    </section>
  );
}
