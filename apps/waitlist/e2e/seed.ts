import { rmSync } from 'node:fs'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { CONFIRM_DELAY_MS, TASKS } from '../src/domain/tasks'
import { walletMessage } from '../src/domain/walletMessage'
import { loadConfig } from '../src/server/config'
import { createPgliteDb, migrate } from '../src/server/db/client'
import type { Deps } from '../src/server/deps'
import { upsertFromX } from '../src/server/entrants'
import { join } from '../src/server/join'
import { confirmTask, openTask } from '../src/server/tasks'
import { bindWallet, issueNonce } from '../src/server/wallet'
import { FakeXClient } from '../src/server/x'
import { E2E_CARD_CODE, E2E_PGLITE_DIR } from './constants'

/**
 * Fresh PGlite dir with one joined entrant (code E2E_CARD_CODE), built through the real services:
 * tasks opened and confirmed on a stepped clock, wallet bound with a genuine signature from a throwaway
 * viem account. Runs before the dev server starts, so the two never open the dir at once.
 */
export default async function globalSetup(): Promise<void> {
  rmSync(E2E_PGLITE_DIR, { recursive: true, force: true })
  const { db, close } = await createPgliteDb(E2E_PGLITE_DIR)
  try {
    await migrate(db)
    let now = Date.now()
    const deps: Deps = {
      db,
      clock: { now: () => new Date(now) },
      x: new FakeXClient({ siteUrl: '' }),
      newCode: () => E2E_CARD_CODE,
      config: loadConfig({ SESSION_SECRET: 'e2e-seed-secret-e2e-seed-secret-00' }),
    }
    const r = await upsertFromX(deps, {
      id: '2000000002',
      username: 'seeded_dragon',
      name: 'Seeded Dragon',
      profileImageUrl: '',
      createdAt: new Date('2015-01-01T00:00:00Z'),
    })
    if (!('entrantId' in r)) throw new Error('seed: upsert failed')
    const id = r.entrantId
    for (const t of TASKS) await openTask(deps, id, t)
    now += CONFIRM_DELAY_MS
    for (const t of TASKS) await confirmTask(deps, id, t)

    const account = privateKeyToAccount(generatePrivateKey())
    const nonce = await issueNonce(deps, id)
    const signature = await account.signMessage({ message: walletMessage('seeded_dragon', account.address, nonce) })
    const bound = await bindWallet(deps, id, { address: account.address, signature, nonce })
    if (!('wallet' in bound)) throw new Error(`seed: wallet bind failed: ${JSON.stringify(bound)}`)
    const joined = await join(deps, id)
    if (!('position' in joined)) throw new Error(`seed: join failed: ${JSON.stringify(joined)}`)
  } finally {
    await close()
  }
}
