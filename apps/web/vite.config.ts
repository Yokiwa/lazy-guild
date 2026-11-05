/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'] },
      manifest: {
        name: '懒人公会 Lazy Guild',
        short_name: '懒人公会',
        description: '给不按计划执行的人用的冒险者公会 · A quest board for people who never follow plans',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: '#2b2140',
        background_color: '#f6efe2',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  // Local dev: run `pnpm --filter @lazy-guild/push-worker dev` and start Vite with VITE_PUSH_API=/api
  server: { proxy: { '/api': 'http://localhost:8787' } },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    env: { TZ: 'America/New_York' },
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
