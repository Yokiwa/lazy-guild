import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

// `pnpm screenshots`: regenerates docs/screenshots/*.png for the README.
export default defineConfig({
  ...base,
  testDir: './scripts',
  testMatch: 'screenshots.spec.ts',
  fullyParallel: false,
  use: { ...base.use, ...devices['iPhone 14'], browserName: 'chromium', deviceScaleFactor: 2 },
});
