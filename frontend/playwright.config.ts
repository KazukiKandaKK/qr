import { defineConfig, devices } from '@playwright/test';

const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: `export PATH=$PATH:$HOME/.local/go/bin && cd ../backend && go build ./... && cd ../frontend && npm run build && cd ../backend && rm -f dev.db && RATE_LIMIT_DISABLED=true DATABASE_URL=${databaseUrl} go run ./cmd/server`,
    url: 'http://localhost:4000/health',
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile chrome', use: { ...devices['Pixel 5'] } },
  ],
});
