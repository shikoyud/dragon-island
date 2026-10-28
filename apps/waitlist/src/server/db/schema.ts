import { sql } from 'drizzle-orm'
import { check, integer, pgTable, primaryKey, text, timestamp, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core'

export const entrants = pgTable('entrants', {
  id: uuid('id').primaryKey().defaultRandom(),
  xUserId: text('x_user_id').notNull().unique(),
  xHandle: text('x_handle').notNull(),
  xName: text('x_name').notNull(),
  xAvatarUrl: text('x_avatar_url'),
  xCreatedAt: timestamp('x_created_at', { withTimezone: true }).notNull(),
  wallet: text('wallet').unique(),
  walletSignedAt: timestamp('wallet_signed_at', { withTimezone: true }),
  position: integer('position').unique(),
  element: text('element').notNull(),
  refCode: text('ref_code').notNull().unique(),
  referredBy: uuid('referred_by').references((): AnyPgColumn => entrants.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  joinedAt: timestamp('joined_at', { withTimezone: true }),
})

export const taskEvents = pgTable(
  'task_events',
  {
    entrantId: uuid('entrant_id')
      .notNull()
      .references(() => entrants.id),
    task: text('task').notNull(),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.entrantId, t.task] }),
    check('task_events_task_check', sql`${t.task} in ('follow','like','repost','comment')`),
  ],
)

export const walletNonces = pgTable('wallet_nonces', {
  nonce: text('nonce').primaryKey(),
  entrantId: uuid('entrant_id')
    .notNull()
    .references(() => entrants.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})
