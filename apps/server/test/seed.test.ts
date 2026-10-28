import { describe, expect, it } from 'vitest'
import { keccak256 } from 'viem'
import { actionSeed, battleSeed, commitHash, newSecret, verifyActionSeed } from '../src/services/seed'

const S = new Uint8Array(32).fill(7)

describe('seeds', () => {
  it('derives deterministic per-player, per-nonce action seeds', () => {
    const a = actionSeed(S, 'p1', 1n)
    expect(a).toEqual(actionSeed(S, 'p1', 1n))
    expect(a.seedHex).toMatch(/^0x[0-9a-f]{64}$/)
    expect(Number.isInteger(a.seed32) && a.seed32 >= 0 && a.seed32 <= 0xffffffff).toBe(true)
    expect(actionSeed(S, 'p1', 2n).seedHex).not.toBe(a.seedHex)
    expect(actionSeed(S, 'p2', 1n).seedHex).not.toBe(a.seedHex)
    expect(actionSeed(new Uint8Array(32).fill(8), 'p1', 1n).seedHex).not.toBe(a.seedHex)
  })

  it('derives battle seeds from the battle id', () => {
    expect(battleSeed(S, 'b1')).toEqual(battleSeed(S, 'b1'))
    expect(battleSeed(S, 'b1').seedHex).not.toBe(battleSeed(S, 'b2').seedHex)
    expect(battleSeed(S, 'p1').seedHex).not.toBe(actionSeed(S, 'p1', 1n).seedHex) // domain-separated
  })

  it('commits with keccak256 and verifies after reveal', () => {
    const commit = commitHash(S)
    expect(commit).toBe(keccak256(S))
    const a = actionSeed(S, 'p1', 5n)
    expect(verifyActionSeed(commit, S, 'p1', 5n, a.seedHex)).toBe(true)
    expect(verifyActionSeed(commit, S, 'p1', 6n, a.seedHex)).toBe(false)
    expect(verifyActionSeed(commit, new Uint8Array(32).fill(9), 'p1', 5n, a.seedHex)).toBe(false)
  })

  it('makes 32-byte secrets', () => {
    const s = newSecret()
    expect(s).toHaveLength(32)
    expect(newSecret()).not.toEqual(s)
  })
})
