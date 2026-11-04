import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, 'migrations'));
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            ALLOWED_ORIGIN: 'https://app.example',
            VAPID_PUBLIC_KEY: 'test-public-key',
            VAPID_PRIVATE_KEY: '{}',
          },
        },
      }),
    ],
    test: { globals: true, setupFiles: ['./test/apply-migrations.ts'] },
  };
});
