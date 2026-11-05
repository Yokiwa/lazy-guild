// Finds the "lazy-guild" D1 database (creating it if needed) and writes its id into wrangler.toml.
// Used by the deploy workflow so nobody has to copy database ids by hand.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const NAME = 'lazy-guild';
const wrangler = (...args) => execFileSync('pnpm', ['exec', 'wrangler', ...args], { encoding: 'utf8' });
const find = () => {
  const list = JSON.parse(wrangler('d1', 'list', '--json'));
  const db = list.find((d) => d.name === NAME);
  return db?.uuid ?? db?.database_id ?? null;
};

let id = find();
if (!id) {
  console.log(`Creating D1 database "${NAME}"…`);
  wrangler('d1', 'create', NAME);
  id = find();
}
if (!id) throw new Error(`Could not find or create D1 database "${NAME}"`);

const toml = readFileSync('wrangler.toml', 'utf8');
writeFileSync('wrangler.toml', toml.replace(/database_id = "[^"]*"/, `database_id = "${id}"`));
console.log(`Using D1 database ${NAME} (${id})`);
