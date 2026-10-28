import { describe, expect, it } from 'vitest'
import { deriveSeed, verifyCommit, verifySeed } from '../src/verify'

// Vectors from apps/server/src/services/seed.ts with S = 0x07 × 32.
const S = `0x${'07'.repeat(32)}` as const
const commit = '0x7b062064095a97578a0f0cf535dd321f48f102ebc87a8ca16dd4b4c5fc6c4da8' as const
const aSeed = '0x285eea5db62dcc549018b61753ba7e5c0709b41c0adeab87c88868243cf2b6aa' as const
const bSeed = '0x34d8c08c39455bdc347c947a6aabdf2f64054b7c99d6e568a2bd0afc0f223c95' as const

describe('verify (WebCrypto)', () => {
  it('reproduces the server’s action and battle seeds from the label', async () => {
    expect(await deriveSeed(S, 'p1:5')).toBe(aSeed)
    expect(await deriveSeed(S, 'battle:offer-9')).toBe(bSeed)
  })

  it('checks the commit and a logged seed', async () => {
    expect(verifyCommit(commit, S)).toBe(true)
    expect(verifyCommit(commit, `0x${'08'.repeat(32)}`)).toBe(false)
    expect(await verifySeed(commit, S, 'p1:5', aSeed)).toBe(true)
    expect(await verifySeed(commit, S, 'p1:6', aSeed)).toBe(false)
    expect(await verifySeed(commit, `0x${'08'.repeat(32)}`, 'p1:5', aSeed)).toBe(false)
  })
})
