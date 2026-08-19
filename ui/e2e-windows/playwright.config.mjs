import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'windows-nodes.spec.mjs',
  timeout: 180_000,
  use: {
    baseURL: process.env.W1_UI_URL || 'http://127.0.0.1:3000',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    // Prefer Playwright Chromium; allow system Chrome when corporate TLS blocks browser download.
    channel: process.env.W1_PLAYWRIGHT_CHANNEL || undefined
  }
});
