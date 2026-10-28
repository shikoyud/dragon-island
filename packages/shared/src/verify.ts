import { bytesToHex, hexToBytes, keccak256, type Hex } from 'viem'

/**
 * Client-side provably-fair checks (spec §17), runnable in browsers and Node 24 via WebCrypto.
 * Server derivation: seed = HMAC-SHA256(S, label); commit = keccak256(S).
 */
export async function deriveSeed(secretHex: Hex, label: string): Promise<Hex> {
  const raw = new Uint8Array(hexToBytes(secretHex)) as BufferSource
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(label) as BufferSource)
  return bytesToHex(new Uint8Array(mac))
}

export function verifyCommit(commitHash: Hex, secretHex: Hex): boolean {
  return keccak256(hexToBytes(secretHex)).toLowerCase() === commitHash.toLowerCase()
}

/** True when the revealed secret matches the commit and reproduces the logged seed for `label`. */
export async function verifySeed(commitHash: Hex, secretHex: Hex, label: string, seedHex: Hex): Promise<boolean> {
  if (!verifyCommit(commitHash, secretHex)) return false
  return (await deriveSeed(secretHex, label)).toLowerCase() === seedHex.toLowerCase()
}
