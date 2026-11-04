import { TOKEN_CAP, TOKEN_PRICE } from './balance';
import type { Rank } from './types';

export type ShopKind = 'hat' | 'cape' | 'background' | 'title' | 'rest_token';
export interface ShopItem {
  id: string;
  kind: ShopKind;
  price: number;
  minRank: Rank;
}

export const REST_TOKEN_ID = 'rest_token';

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'hat_leaf', kind: 'hat', price: 40, minRank: 'F' },
  { id: 'hat_witch', kind: 'hat', price: 90, minRank: 'E' },
  { id: 'hat_knight', kind: 'hat', price: 200, minRank: 'C' },
  { id: 'hat_crown', kind: 'hat', price: 600, minRank: 'A' },
  { id: 'cape_traveler', kind: 'cape', price: 60, minRank: 'F' },
  { id: 'cape_guild', kind: 'cape', price: 160, minRank: 'D' },
  { id: 'cape_starlight', kind: 'cape', price: 450, minRank: 'B' },
  { id: 'bg_forest', kind: 'background', price: 80, minRank: 'F' },
  { id: 'bg_town', kind: 'background', price: 180, minRank: 'D' },
  { id: 'bg_demon_castle', kind: 'background', price: 600, minRank: 'A' },
  { id: 'title_early_bird', kind: 'title', price: 50, minRank: 'E' },
  { id: 'title_dragon_tamer', kind: 'title', price: 300, minRank: 'B' },
  { id: REST_TOKEN_ID, kind: 'rest_token', price: TOKEN_PRICE, minRank: 'F' },
];

const RANK_ORDER: Rank[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
const rankIdx = (r: Rank) => RANK_ORDER.indexOf(r);

export type BuyCheck = 'ok' | 'rank' | 'gold' | 'owned' | 'token_cap';

export function checkBuy(
  item: ShopItem,
  s: { gold: number; rank: Rank; owned: string[]; tokens: number },
): BuyCheck {
  if (rankIdx(s.rank) < rankIdx(item.minRank)) return 'rank';
  if (item.kind === 'rest_token') {
    if (s.tokens >= TOKEN_CAP) return 'token_cap';
  } else if (s.owned.includes(item.id)) return 'owned';
  if (s.gold < item.price) return 'gold';
  return 'ok';
}

export function newlyUnlocked(rankBefore: Rank, rankAfter: Rank): ShopItem[] {
  return SHOP_ITEMS.filter((i) => rankIdx(i.minRank) > rankIdx(rankBefore) && rankIdx(i.minRank) <= rankIdx(rankAfter));
}
