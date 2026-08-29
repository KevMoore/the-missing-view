import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: 0,
  use: { baseURL: 'http://localhost:3102' },
  webServer: {
    command: 'pnpm --filter @tmv/web build && PORT=3102 pnpm --filter @tmv/server exec tsx src/index.ts',
    url: 'http://localhost:3102/healthz',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
