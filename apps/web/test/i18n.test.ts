import en from '../src/i18n/en.json';
import zh from '../src/i18n/zh.json';

type Tree = { [k: string]: string | string[] | Tree };
const keys = (o: Tree, p = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`],
  );
const values = (o: Tree): (string | string[])[] =>
  Object.values(o).flatMap((v) => (typeof v === 'object' && !Array.isArray(v) ? values(v) : [v]));

test('zh and en have identical keys', () => expect(keys(zh as Tree).sort()).toEqual(keys(en as Tree).sort()));
test('no empty strings', () => {
  for (const v of [...values(zh as Tree), ...values(en as Tree)]) {
    if (Array.isArray(v)) for (const s of v) expect(s.trim()).not.toBe('');
    else expect(v.trim()).not.toBe('');
  }
});
