import { createHmac, randomBytes } from 'node:crypto'
import { bytesToHex, hexToBytes, keccak256, type Hex } from 'viem'

/**
 * Provably-fair randomness (spec §17). One game secret S (A1); its keccak256 is published up
 * front and S is revealed when the game reveals it, so every seed below can be re-derived by players.
 */
export interface DerivedSeed { seedHex: Hex; seed32: number }

export const newSecret = (): Uint8Array => new Uint8Array(randomBytes(32))

export const commitHash = (secret: Uint8Array): Hex => keccak256(secret)

function derive(secret: Uint8Array, label: string): DerivedSeed {
  const mac = createHmac('sha256', secret).update(label).digest()
  const seedHex = bytesToHex(new Uint8Array(mac))
  const seed32 = mac.readUInt32BE(0)
  return { seedHex, seed32 }
}

/** Seed for one player action: HMAC-SHA256(S, playerId ‖ ":" ‖ nonce); first 4 bytes feed createRng. */
export const actionSeed = (secret: Uint8Array, playerId: string, nonce: bigint): DerivedSeed =>
  derive(secret, `${playerId}:${nonce}`)

/** Seed for one battle, domain-separated from action seeds. */
export const battleSeed = (secret: Uint8Array, battleId: string): DerivedSeed => derive(secret, `battle:${battleId}`)

/** What a player runs after the reveal: the secret matches the commit and reproduces the logged seed. */
export function verifyActionSeed(commit: Hex, revealed: Uint8Array, playerId: string, nonce: bigint, seedHex: Hex): boolean {
  return commitHash(revealed) === commit && actionSeed(revealed, playerId, nonce).seedHex === seedHex
}

export const secretFromHex = (hex: string): Uint8Array => hexToBytes(hex as Hex)
