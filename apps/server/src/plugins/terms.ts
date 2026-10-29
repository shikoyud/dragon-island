import type { FastifyRequest } from 'fastify'
import type { Config } from '../config'
import { AppError } from './errors'
import type { PlayerRow } from './session'

/** The terms version this player still has to accept, or null when none is required or it is accepted. */
export const termsRequired = (config: Config, player: Pick<PlayerRow, 'termsVersion'>): string | null =>
  config.TERMS_VERSION !== '' && player.termsVersion !== config.TERMS_VERSION ? config.TERMS_VERSION : null

/**
 * preHandler after requireSession: gameplay waits for the current terms (428). Never used on sign-in,
 * /me or withdrawals, so a player can always see their state and take their tokens out.
 */
export function requireTerms(config: Config) {
  return async (req: FastifyRequest): Promise<void> => {
    if (termsRequired(config, req.player!)) throw new AppError(428, 'TERMS_REQUIRED')
  }
}
