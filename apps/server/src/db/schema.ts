import { sql } from 'drizzle-orm'
import {
  bigint, bigserial, boolean, check, customType, index, integer, jsonb, pgTable, primaryKey, serial, text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core'

/** Exact integer money: numeric(78,0) on disk, bigint in TypeScript. */
const wei = customType<{ data: bigint; driverData: string }>({
  dataType: () => 'numeric(78,0)',
  toDriver: (v: bigint) => v.toString(),
  fromDriver: (v: string) => BigInt(v),
})

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()

export const players = pgTable('players', {
  id: uuid('id').primaryKey().defaultRandom(),
  address: text('address').notNull().unique(),
  /** game-core PlayerState; only ever written through applyAction. */
  state: jsonb('state').notNull(),
  actionNonce: bigint('action_nonce', { mode: 'bigint' }).notNull().default(sql`0`),
  earningUnlocked: boolean('earning_unlocked').notNull().default(false),
  bannedAt: timestamp('banned_at', { withTimezone: true }),
  banReason: text('ban_reason'),
  /** Duplicated from state for matchmaking queries. */
  trophies: integer('trophies').notNull().default(0),
  defenceTeam: jsonb('defence_team'),
  level: integer('level').notNull().default(1),
  /** Referral (spec §16): who referred this player, and sign-in hashes used to refuse self-referral. */
  referrerId: uuid('referrer_id'),
  ipHash: text('ip_hash'),
  deviceHash: text('device_hash'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const sessions = pgTable('sessions', {
  token: text('token').primaryKey(),
  playerId: uuid('player_id').notNull().references(() => players.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, t => [index('sessions_player_idx').on(t.playerId)])

export const siweNonces = pgTable('siwe_nonces', {
  nonce: text('nonce').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})

/** Closed-beta allowlist: lowercase wallet addresses permitted to sign in while BETA_CLOSED is on. */
export const betaAllowlist = pgTable('beta_allowlist', {
  address: text('address').primaryKey(),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
})

export const seasons = pgTable('seasons', {
  id: serial('id').primaryKey(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  secretHex: text('secret_hex').notNull(),
  commitHash: text('commit_hash').notNull(),
  revealed: boolean('revealed').notNull().default(false),
  /** Set by the season-close job once prizes are credited and trophies reset. */
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: createdAt(),
}, t => [uniqueIndex('seasons_starts_at_unique').on(t.startsAt)])

/** Spec §12: every token inflow the vault keeps, per season; 30% of the season total is the prize pool. */
export const vaultInflows = pgTable('vault_inflows', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  seasonId: integer('season_id').notNull().references(() => seasons.id),
  source: text('source').notNull(), // spend | depositFee | claimFee | buyback | forfeit
  wei: wei('wei').notNull(),
  ref: text('ref').notNull(),
  createdAt: createdAt(),
}, t => [uniqueIndex('vault_inflows_source_ref').on(t.source, t.ref), index('vault_inflows_season').on(t.seasonId)])

export const seasonPrizes = pgTable('season_prizes', {
  seasonId: integer('season_id').notNull().references(() => seasons.id),
  playerId: uuid('player_id').notNull().references(() => players.id),
  wei: wei('wei').notNull(),
  tier: integer('tier'),
  rank: integer('rank'),
  createdAt: createdAt(),
}, t => [primaryKey({ columns: [t.seasonId, t.playerId] })])

/**
 * Every (ip, device) pair a player has ever signed in from, as salted hashes ('' when unknown). Referral
 * checks compare whole histories, so moving to a VPN for one sign-in does not hide a shared device.
 */
export const signInOrigins = pgTable('sign_in_origins', {
  playerId: uuid('player_id').notNull().references(() => players.id),
  ipHash: text('ip_hash').notNull().default(''),
  deviceHash: text('device_hash').notNull().default(''),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.playerId, t.ipHash, t.deviceHash] })])

/** Spec §16: 5% of a referred player's spend, paid to the referrer from the vault's share. */
export const referralPayouts = pgTable('referral_payouts', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  referrerId: uuid('referrer_id').notNull().references(() => players.id),
  referredId: uuid('referred_id').notNull().references(() => players.id),
  wei: wei('wei').notNull(),
  ref: text('ref').notNull().unique(),
  createdAt: createdAt(),
}, t => [index('referral_payouts_referrer').on(t.referrerId)])

export const actionLog = pgTable('action_log', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  playerId: uuid('player_id').notNull().references(() => players.id),
  nonce: bigint('nonce', { mode: 'bigint' }).notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  seasonId: integer('season_id').notNull().references(() => seasons.id),
  seedHex: text('seed_hex').notNull(),
  /** What the seed was derived from: `<player>:<nonce>` for actions, `battle:<id>` for battles (spec §17). */
  seedLabel: text('seed_label').notNull().default(''),
  action: jsonb('action').notNull(),
  status: integer('status').notNull(),
  response: jsonb('response').notNull(),
  createdAt: createdAt(),
}, t => [
  uniqueIndex('action_log_player_key').on(t.playerId, t.idempotencyKey),
  index('action_log_season_player_idx').on(t.seasonId, t.playerId, t.nonce),
])

export const spLedger = pgTable('sp_ledger', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  playerId: uuid('player_id').notNull().references(() => players.id),
  seasonId: integer('season_id').notNull().references(() => seasons.id),
  day: integer('day').notNull(),
  source: text('source').notNull(),
  points: integer('points').notNull(),
  ref: text('ref').notNull().default(''),
  createdAt: createdAt(),
}, t => [uniqueIndex('sp_ledger_once').on(t.playerId, t.seasonId, t.day, t.source, t.ref)])

export const battleOffers = pgTable('battle_offers', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').notNull().references(() => players.id),
  opponentPlayerId: uuid('opponent_player_id').references(() => players.id),
  opponent: jsonb('opponent').notNull(),
  seedHex: text('seed_hex').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: createdAt(),
}, t => [index('battle_offers_player_idx').on(t.playerId)])

export const balances = pgTable('balances', {
  playerId: uuid('player_id').primaryKey().references(() => players.id),
  tokenWei: wei('token_wei').notNull().default(sql`0`),
  depositedWei: wei('deposited_wei').notNull().default(sql`0`),
  withdrawnWei: wei('withdrawn_wei').notNull().default(sql`0`),
  spentWei: wei('spent_wei').notNull().default(sql`0`),
  /** Payouts and prizes; forfeited on ban. */
  earnedWei: wei('earned_wei').notNull().default(sql`0`),
  updatedAt: updatedAt(),
}, t => [check('balances_token_wei_nonneg', sql`${t.tokenWei} >= 0`)])

export const vouchers = pgTable('vouchers', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').notNull().references(() => players.id),
  cumulativeWei: wei('cumulative_wei').notNull(),
  grossWei: wei('gross_wei').notNull(),
  deadlineAt: timestamp('deadline_at', { withTimezone: true }).notNull(),
  signature: text('signature').notNull(),
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  expiredAt: timestamp('expired_at', { withTimezone: true }),
  createdAt: createdAt(),
}, t => [index('vouchers_open_idx').on(t.playerId).where(sql`claimed_at is null and expired_at is null`)])

export const chainEvents = pgTable('chain_events', {
  txHash: text('tx_hash').notNull(),
  logIndex: integer('log_index').notNull(),
  blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(),
  name: text('name').notNull(),
  args: jsonb('args').notNull(),
  /** False when the wallet had no player yet; applied on that wallet's first sign-in. */
  applied: boolean('applied').notNull().default(true),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.txHash, t.logIndex] })])

export const indexerState = pgTable('indexer_state', {
  key: text('key').primaryKey(),
  lastBlock: bigint('last_block', { mode: 'bigint' }).notNull(),
})

export const spendBatches = pgTable('spend_batches', {
  day: integer('day').primaryKey(),
  spentWei: wei('spent_wei').notNull().default(sql`0`),
  burnedWei: wei('burned_wei').notNull().default(sql`0`),
  burnTx: text('burn_tx'),
  updatedAt: updatedAt(),
})

/** Operator burns, recorded before sending so a crash can never burn the same batch twice. */
export const burnAttempts = pgTable('burn_attempts', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  day: integer('day').notNull(),
  amountWei: wei('amount_wei').notNull(),
  txHash: text('tx_hash'),
  status: text('status').notNull().default('pending'), // pending | confirmed | reverted
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
  count: integer('count').notNull(),
})

export const priceOverrides = pgTable('price_overrides', {
  id: integer('id').primaryKey(),
  microUsdPerToken: wei('micro_usd_per_token').notNull(),
  setAt: timestamp('set_at', { withTimezone: true }).notNull().defaultNow(),
})
