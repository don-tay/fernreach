import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  // CI runners draw WebGL in software and are several times slower than a laptop; allow waits more time there.
  expect: { timeout: process.env.CI ? 15_000 : 5_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5199',
    trace: 'retain-on-failure',
    viewport: { width: 1024, height: 768 },
  },
  projects: [
    { name: 'chromium', testIgnore: /mobile\.spec/, use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } } },
    { name: 'mobile', testMatch: /mobile\.spec/, use: { ...devices['Pixel 7 landscape'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5199',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
