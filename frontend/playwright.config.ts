import { defineConfig, devices } from '@playwright/test';

const databaseUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';

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
    command: `cd ../backend && rm -f prisma/dev.db && DATABASE_URL=${databaseUrl} npx prisma migrate deploy && DATABASE_URL=${databaseUrl} npm run build && cd ../frontend && npm run build && cd ../backend && DATABASE_URL=${databaseUrl} npm start`,
    url: 'http://localhost:4000/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile chrome', use: { ...devices['Pixel 5'] } },
  ],
});
