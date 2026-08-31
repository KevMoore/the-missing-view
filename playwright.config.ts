import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  /**
   * The `*-shots` specs write screenshots for a person to look at; they assert
   * almost nothing and they are the slowest things in the directory. Run one on
   * purpose — `pnpm exec playwright test art-shots --grep-invert nothing` — or
   * with `TMV_SHOTS=1`, not on every push.
   */
  ...(process.env.TMV_SHOTS ? {} : { testIgnore: '**/*-shots.spec.ts' }),
  timeout: 60_000,
  retries: 0,
  use: { baseURL: 'http://localhost:3102' },
  webServer: {
    command:
      'pnpm --filter @tmv/web build && TMV_TEST=1 TMV_BOT_TICK_MS=2000 PORT=3102 pnpm --filter @tmv/server exec tsx src/index.ts',
    url: 'http://localhost:3102/healthz',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
