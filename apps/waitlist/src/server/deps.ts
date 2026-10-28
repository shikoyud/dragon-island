import type { Config } from './config'
import type { Db } from './db/client'

export interface Clock {
  now(): Date
}

export type XProfile = { id: string; username: string; name: string; profileImageUrl: string; createdAt: Date }

/** Implemented in src/server/x.ts. */
export interface XClient {
  authorizeUrl(state: string, challenge: string): string
  exchangeCode(code: string, verifier: string): Promise<string>
  me(accessToken: string): Promise<XProfile>
}

export interface Deps {
  db: Db
  clock: Clock
  x: XClient
  newCode: () => string
  config: Config
}

export const systemClock: Clock = { now: () => new Date() }
