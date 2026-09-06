import { defineConfig, devices } from '@playwright/test';

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();
const baseURL = externalBaseUrl || 'http://localhost:8081';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: 'npm run web -- --port 8081',
        url: 'http://localhost:8081',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

