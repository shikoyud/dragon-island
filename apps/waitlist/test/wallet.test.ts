import { eq } from 'drizzle-orm'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { walletMessage } from '../src/domain/walletMessage'
import { entrants, walletNonces } from '../src/server/db/schema'
import { getEntrantState, upsertFromX } from '../src/server/entrants'
import { bindWallet, issueNonce } from '../src/server/wallet'
import { makeTestDeps } from './helpers'

type TD = Awaited<ReturnType<typeof makeTestDeps>>
let d: TD

async function makeEntrant(xid: string, username: string): Promise<string> {
  const r = await upsertFromX(d, {
    id: xid,
    username,
    name: username,
    profileImageUrl: 'https://pbs.twimg.com/profile_images/1/pic_normal.jpg',
    createdAt: new Date(d.clock.now().getTime() - 400 * 86_400_000),
  })
  if (!('entrantId' in r)) throw new Error('expected entrantId')
  return r.entrantId
}

let a: string
let b: string
beforeEach(async () => {
  d = await makeTestDeps()
  a = await makeEntrant('1001', 'ember')
  b = await makeEntrant('1002', 'tide')
})
afterEach(async () => {
  await d.close()
})

const newKey = () => privateKeyToAccount(generatePrivateKey())
async function signFor(acct: ReturnType<typeof newKey>, handle: string, nonce: string) {
  return acct.signMessage({ message: walletMessage(handle, acct.address, nonce) })
}
const nonceRows = (nonce: string) => d.db.select().from(walletNonces).where(eq(walletNonces.nonce, nonce))

describe('issueNonce', () => {
  it('returns 32 hex chars expiring in 10 minutes', async () => {
    const nonce = await issueNonce(d, a)
    expect(nonce).toMatch(/^[0-9a-f]{32}$/)
    const [row] = await nonceRows(nonce)
    expect(row!.expiresAt).toEqual(new Date(d.clock.now().getTime() + 600_000))
    expect(row!.entrantId).toBe(a)
  })
})

describe('bindWallet', () => {
  it('stores the lowercase address and signing time', async () => {
    const acct = newKey()
    const nonce = await issueNonce(d, a)
    const res = await bindWallet(d, a, { address: acct.address, signature: await signFor(acct, 'ember', nonce), nonce })
    expect(res).toEqual({ wallet: acct.address.toLowerCase() })
    const [row] = await d.db.select().from(entrants).where(eq(entrants.id, a))
    expect(row!.wallet).toBe(acct.address.toLowerCase())
    expect(row!.walletSignedAt).toEqual(d.clock.now())
    expect((await getEntrantState(d, a))!.wallet).toBe(acct.address.toLowerCase())
  })

  it('accepts a lowercase address input', async () => {
    const acct = newKey()
    const nonce = await issueNonce(d, a)
    const res = await bindWallet(d, a, {
      address: acct.address.toLowerCase(),
      signature: await signFor(acct, 'ember', nonce),
      nonce,
    })
    expect(res).toEqual({ wallet: acct.address.toLowerCase() })
  })

  it('a reused nonce is NONCE_INVALID', async () => {
    const acct = newKey()
    const nonce = await issueNonce(d, a)
    const input = { address: acct.address, signature: await signFor(acct, 'ember', nonce), nonce }
    await bindWallet(d, a, input)
    expect(await bindWallet(d, a, input)).toEqual({ error: 'NONCE_INVALID' })
  })

  it('an unknown nonce is NONCE_INVALID', async () => {
    const acct = newKey()
    const nonce = 'ab'.repeat(16)
    const sig = await signFor(acct, 'ember', nonce)
    expect(await bindWallet(d, a, { address: acct.address, signature: sig, nonce })).toEqual({ error: 'NONCE_INVALID' })
  })

  it('a nonce older than 10 minutes is NONCE_INVALID', async () => {
    const acct = newKey()
    const nonce = await issueNonce(d, a)
    d.clock.advance(600_001)
    const sig = await signFor(acct, 'ember', nonce)
    expect(await bindWallet(d, a, { address: acct.address, signature: sig, nonce })).toEqual({ error: 'NONCE_INVALID' })
  })

  it('another entrant nonce is NONCE_INVALID and is not consumed', async () => {
    const acct = newKey()
    const nonce = await issueNonce(d, b)
    const sig = await signFor(acct, 'ember', nonce)
    expect(await bindWallet(d, a, { address: acct.address, signature: sig, nonce })).toEqual({ error: 'NONCE_INVALID' })
    expect(await nonceRows(nonce)).toHaveLength(1)
  })

  it('a message signed for a different handle is INVALID_SIGNATURE and burns the nonce', async () => {
    const acct = newKey()
    const nonce = await issueNonce(d, a)
    const input = { address: acct.address, signature: await signFor(acct, 'someoneelse', nonce), nonce }
    expect(await bindWallet(d, a, input)).toEqual({ error: 'INVALID_SIGNATURE' })
    expect(await nonceRows(nonce)).toHaveLength(0)
    expect(await bindWallet(d, a, input)).toEqual({ error: 'NONCE_INVALID' })
  })

  it('a signature by a different key is INVALID_SIGNATURE', async () => {
    const acct = newKey()
    const other = newKey()
    const nonce = await issueNonce(d, a)
    const sig = await other.signMessage({ message: walletMessage('ember', acct.address, nonce) })
    expect(await bindWallet(d, a, { address: acct.address, signature: sig, nonce })).toEqual({ error: 'INVALID_SIGNATURE' })
  })

  it('a garbage signature is INVALID_SIGNATURE, not a throw', async () => {
    const acct = newKey()
    const nonce = await issueNonce(d, a)
    expect(await bindWallet(d, a, { address: acct.address, signature: '0x1234', nonce })).toEqual({
      error: 'INVALID_SIGNATURE',
    })
  })

  it('a malformed or bad-checksum address is BAD_REQUEST without consuming the nonce', async () => {
    const acct = newKey()
    const nonce = await issueNonce(d, a)
    const sig = await signFor(acct, 'ember', nonce)
    // Flip the case of one hex letter so the mixed-case checksum no longer matches.
    const body = acct.address.slice(2)
    const i = body.search(/[a-fA-F]/)
    const flipped = body[i] === body[i]!.toLowerCase() ? body[i]!.toUpperCase() : body[i]!.toLowerCase()
    const bad = `0x${body.slice(0, i)}${flipped}${body.slice(i + 1)}`
    expect(await bindWallet(d, a, { address: 'not-an-address', signature: sig, nonce })).toEqual({ error: 'BAD_REQUEST' })
    expect(await bindWallet(d, a, { address: bad, signature: sig, nonce })).toEqual({ error: 'BAD_REQUEST' })
    expect(await nonceRows(nonce)).toHaveLength(1)
  })

  it('an address bound to another entrant is WALLET_TAKEN', async () => {
    const acct = newKey()
    const n1 = await issueNonce(d, a)
    await bindWallet(d, a, { address: acct.address, signature: await signFor(acct, 'ember', n1), nonce: n1 })
    const n2 = await issueNonce(d, b)
    const sig = await signFor(acct, 'tide', n2)
    expect(await bindWallet(d, b, { address: acct.address, signature: sig, nonce: n2 })).toEqual({ error: 'WALLET_TAKEN' })
  })

  it('rebinding before Join replaces the wallet', async () => {
    const first = newKey()
    const second = newKey()
    const n1 = await issueNonce(d, a)
    await bindWallet(d, a, { address: first.address, signature: await signFor(first, 'ember', n1), nonce: n1 })
    const n2 = await issueNonce(d, a)
    const sig = await signFor(second, 'ember', n2)
    expect(await bindWallet(d, a, { address: second.address, signature: sig, nonce: n2 })).toEqual({
      wallet: second.address.toLowerCase(),
    })
    const [row] = await d.db.select().from(entrants).where(eq(entrants.id, a))
    expect(row!.wallet).toBe(second.address.toLowerCase())
  })

  it('rebinding after Join is BAD_REQUEST', async () => {
    const first = newKey()
    const second = newKey()
    const n1 = await issueNonce(d, a)
    await bindWallet(d, a, { address: first.address, signature: await signFor(first, 'ember', n1), nonce: n1 })
    await d.db.update(entrants).set({ position: 1, joinedAt: d.clock.now() }).where(eq(entrants.id, a))
    const n2 = await issueNonce(d, a)
    const sig = await signFor(second, 'ember', n2)
    expect(await bindWallet(d, a, { address: second.address, signature: sig, nonce: n2 })).toEqual({ error: 'BAD_REQUEST' })
    const [row] = await d.db.select().from(entrants).where(eq(entrants.id, a))
    expect(row!.wallet).toBe(first.address.toLowerCase())
  })

  it('an unknown entrant is BAD_REQUEST', async () => {
    const acct = newKey()
    const res = await bindWallet(d, '00000000-0000-4000-8000-000000000000', {
      address: acct.address,
      signature: '0x00',
      nonce: 'x',
    })
    expect(res).toEqual({ error: 'BAD_REQUEST' })
  })
})
