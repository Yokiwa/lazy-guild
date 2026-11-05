import i18n from 'i18next';
import { OCCASIONS, pickLine } from '../src/content/lines';
import { initI18n, resources } from '../src/i18n';

const SPECIES = ['slime', 'foxfire', 'drake'] as const;

test.each(SPECIES)('%s has ≥3 lines per occasion in both languages', (sp) => {
  for (const lang of ['zh', 'en'] as const)
    for (const occ of OCCASIONS) {
      const lines = (resources[lang].translation.lines as Record<string, Record<string, string[]>>)[sp]![occ]!;
      expect(lines.length).toBeGreaterThanOrEqual(3);
    }
});

test('pickLine picks from the current language', async () => {
  await initI18n('en');
  expect(pickLine(i18n.t, 'slime', 'done', () => 0)).toBe('Amazing! I’m so happy I turned extra round!');
  await i18n.changeLanguage('zh');
  expect(pickLine(i18n.t, 'drake', 'skipped', () => 0.99)).toBe('明天再一起出发！说好了！');
});
