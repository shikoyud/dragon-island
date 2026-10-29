import { defineConfig } from '@playwright/test'

/**
 * Smoke tests (spec §20). Boots the game server in E2E mode (in-memory PGlite, fake chain, fixed
 * price, /e2e/grant) and the Vite dev server with the deterministic test wallet.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  retries: 0,
  workers: 1,
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'pnpm --filter @wyrmhaven/server start',
      url: 'http://localhost:3000/health',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        E2E: '1', PORT: '3000',
        SESSION_SECRET: 'e2e-session-secret-at-least-32-characters-long', ADMIN_TOKEN: 'e2e-admin-token-0123456789abcdef-32',
        SIWE_DOMAIN: 'localhost:5173', SIWE_URI: 'http://localhost:5173',
        // Voucher signing needs a signer key and a vault address for the EIP-712 domain (anvil account 1, dummy vault).
        SIGNER_PRIVATE_KEY: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
        VAULT_ADDRESS: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      },
    },
    {
      command: 'pnpm --filter @wyrmhaven/web exec vite --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_TEST_WALLET: '1', VITE_API_URL: '/api' },
    },
  ],
})
