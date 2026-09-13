import { defineConfig } from '@playwright/test';

/**
 * Browser journey against a running web app (`pnpm web dev`) and its local database.
 * Uses the system Chrome so no browser download is needed.
 */
export default defineConfig({
  testDir: './apps/web/test/browser',
  timeout: 60_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env['ASSURE_WEB_URL'] ?? 'http://localhost:3000',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
  },
});
