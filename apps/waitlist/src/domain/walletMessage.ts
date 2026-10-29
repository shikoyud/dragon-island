import { getAddress } from 'viem'

export function walletMessage(handle: string, address: `0x${string}`, nonce: string): string {
  return `Dragon Island waitlist\nX: @${handle}\nAddress: ${getAddress(address)}\nNonce: ${nonce}`
}
