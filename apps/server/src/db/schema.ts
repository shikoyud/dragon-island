import { sql } from 'drizzle-orm'
import {
  bigint, bigserial, boolean, customType, integer, jsonb, pgTable, primaryKey, serial, text, timestamp, uniqueIndex, uuid,
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
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const sessions = pgTable('sessions', {
  token: text('token').primaryKey(),
  playerId: uuid('player_id').notNull().references(() => players.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
})

export const siweNonces = pgTable('siwe_nonces', {
  nonce: text('nonce').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})

export const seasons = pgTable('seasons', {
  id: serial('id').primaryKey(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  secretHex: text('secret_hex').notNull(),
  commitHash: text('commit_hash').notNull(),
  revealed: boolean('revealed').notNull().default(false),
  createdAt: createdAt(),
})

export const actionLog = pgTable('action_log', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  playerId: uuid('player_id').notNull().references(() => players.id),
  nonce: bigint('nonce', { mode: 'bigint' }).notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  seasonId: integer('season_id').notNull().references(() => seasons.id),
  seedHex: text('seed_hex').notNull(),
  action: jsonb('action').notNull(),
  status: integer('status').notNull(),
  response: jsonb('response').notNull(),
  createdAt: createdAt(),
}, t => [uniqueIndex('action_log_player_key').on(t.playerId, t.idempotencyKey)])

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
})

export const balances = pgTable('balances', {
  playerId: uuid('player_id').primaryKey().references(() => players.id),
  tokenWei: wei('token_wei').notNull().default(sql`0`),
  depositedWei: wei('deposited_wei').notNull().default(sql`0`),
  withdrawnWei: wei('withdrawn_wei').notNull().default(sql`0`),
  spentWei: wei('spent_wei').notNull().default(sql`0`),
  /** Payouts and prizes; forfeited on ban. */
  earnedWei: wei('earned_wei').notNull().default(sql`0`),
  updatedAt: updatedAt(),
})

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
})

export const chainEvents = pgTable('chain_events', {
  txHash: text('tx_hash').notNull(),
  logIndex: integer('log_index').notNull(),
  blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(),
  name: text('name').notNull(),
  args: jsonb('args').notNull(),
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
