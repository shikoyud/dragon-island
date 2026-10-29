import { createSiweMessage } from 'viem/siwe'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'

export const TEST_KEYS = {
  alice: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  bob: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  carol: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  dave: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
  erin: '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
} as const

export const wallet = (key: `0x${string}`): PrivateKeyAccount => privateKeyToAccount(key)

/** Builds and signs a SIWE message for the app's domain/uri/chain. */
export async function signSiwe(
  account: PrivateKeyAccount,
  nonce: string,
  opts: { domain?: string; uri?: string; chainId?: number; issuedAt?: Date } = {},
): Promise<{ message: string; signature: `0x${string}` }> {
  const message = createSiweMessage({
    address: account.address,
    chainId: opts.chainId ?? 46630,
    domain: opts.domain ?? 'localhost',
    nonce,
    uri: opts.uri ?? 'http://localhost:5173',
    version: '1',
    issuedAt: opts.issuedAt ?? new Date(0),
  })
  const signature = await account.signMessage({ message })
  return { message, signature }
}
