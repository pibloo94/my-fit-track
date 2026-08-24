import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const repoRoot = process.cwd();
const apiHealthUrl = 'http://127.0.0.1:3000/api/v1/health';
const webUrl = 'http://127.0.0.1:4200';

/**
 * One smoke journey for phase 1: the Angular app loads and renders a health
 * payload from the API through the shared contract. Preview-deployment E2E
 * waits until staging exists; locally and in CI this boots the two apps.
 */
export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  outputDir: path.join(repoRoot, 'test-results'),
  use: {
    baseURL: webUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node dist/main.js',
      cwd: path.join(repoRoot, 'apps/api'),
      url: apiHealthUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stderr: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PORT: '3000',
        HOST: '127.0.0.1',
      },
    },
    {
      command: 'npm run start --workspace @my-fit-track/web -- --host 127.0.0.1 --port 4200',
      cwd: repoRoot,
      url: webUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stderr: 'pipe',
    },
  ],
});
