import { SHOP_ITEMS, checkBuy, newlyUnlocked } from '../src/shop';

test('catalog shape', () => {
  const nonToken = SHOP_ITEMS.filter((i) => i.kind !== 'rest_token');
  expect(nonToken.length).toBeGreaterThanOrEqual(12);
  expect(new Set(SHOP_ITEMS.map((i) => i.id)).size).toBe(SHOP_ITEMS.length);
  for (const kind of ['hat', 'cape', 'background', 'title'] as const)
    expect(nonToken.filter((i) => i.kind === kind).length).toBeGreaterThan(0);
  expect(SHOP_ITEMS.filter((i) => i.kind === 'rest_token')).toHaveLength(1);
  for (const i of nonToken) {
    expect(i.price).toBeGreaterThanOrEqual(40);
    expect(i.price).toBeLessThanOrEqual(600);
  }
});
test('checkBuy order', () => {
  const hat = SHOP_ITEMS.find((i) => i.kind === 'hat' && i.minRank === 'C')!;
  expect(checkBuy(hat, { gold: 9999, rank: 'D', owned: [], tokens: 0 })).toBe('rank');
  expect(checkBuy(hat, { gold: 0, rank: 'C', owned: [], tokens: 0 })).toBe('gold');
  expect(checkBuy(hat, { gold: 9999, rank: 'C', owned: [hat.id], tokens: 0 })).toBe('owned');
  expect(checkBuy(hat, { gold: hat.price, rank: 'S', owned: [], tokens: 0 })).toBe('ok');
  const token = SHOP_ITEMS.find((i) => i.kind === 'rest_token')!;
  expect(checkBuy(token, { gold: 9999, rank: 'F', owned: [], tokens: 3 })).toBe('token_cap');
  expect(checkBuy(token, { gold: 9999, rank: 'F', owned: [token.id], tokens: 2 })).toBe('ok');
});
test('newlyUnlocked lists items whose rank was just reached', () => {
  const ids = newlyUnlocked('E', 'C').map((i) => i.minRank);
  expect(ids.length).toBeGreaterThan(0);
  expect(new Set(ids)).toEqual(new Set(ids.filter((r) => r === 'D' || r === 'C')));
  expect(newlyUnlocked('C', 'C')).toEqual([]);
});
