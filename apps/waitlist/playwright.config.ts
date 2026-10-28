import { defineConfig } from '@playwright/test'
import { E2E_PGLITE_DIR, E2E_PORT } from './e2e/constants'

const baseURL = `http://localhost:${E2E_PORT}`

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.spec.ts',
  globalSetup: './e2e/seed.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL, browserName: 'chromium' },
  webServer: {
    command: `pnpm exec next dev -p ${E2E_PORT}`,
    // The home page does not touch the database, so readiness polling cannot open the PGlite dir early.
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      X_FAKE: '1',
      NODE_ENV: 'development',
      SESSION_SECRET: 'e2e-session-secret-e2e-session-secret',
      PGLITE_DIR: E2E_PGLITE_DIR,
      NEXT_PUBLIC_SITE_URL: baseURL,
      NEXT_PUBLIC_REOWN_PROJECT_ID: '',
      DATABASE_URL: '',
    },
  },
})
