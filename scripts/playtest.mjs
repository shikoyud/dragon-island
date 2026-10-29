// Local playtest with no wallet and no chain: the server runs in E2E mode (in-memory PGlite, fake chain,
// fixed price) and the web app uses the in-page test wallet. Same configuration as the Playwright suite.
import { spawn } from 'node:child_process'

const sh = process.platform === 'win32'
const run = (name, args, env) => {
  const p = spawn('pnpm', args, { stdio: 'inherit', shell: sh, env: { ...process.env, ...env } })
  p.on('exit', code => { if (code) console.error(`[${name}] exited with ${code}`) })
  return p
}

const server = run('server', ['--filter', '@wyrmhaven/server', 'start'], {
  E2E: '1', PORT: '3000',
  SESSION_SECRET: 'playtest-session-secret-at-least-32-characters',
  ADMIN_TOKEN: 'playtest-admin',
  SIWE_DOMAIN: 'localhost:5173', SIWE_URI: 'http://localhost:5173',
  // Anvil account 1 and a dummy vault address, as in playwright.config.ts: test values only.
  SIGNER_PRIVATE_KEY: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  VAULT_ADDRESS: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
})
const web = run('web', ['--filter', '@wyrmhaven/web', 'exec', 'vite', '--port', '5173', '--strictPort'], {
  VITE_TEST_WALLET: '1', VITE_API_URL: '/api',
})

const stop = () => { server.kill(); web.kill(); process.exit(0) }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
console.log('\nPlaytest: open http://localhost:5173 (test wallet, in-memory server; state resets on restart)\n')
