import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'

/** Typed failure that maps straight to an HTTP status and `{ error }` body (spec §19). */
export class AppError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(code)
  }
}

/**
 * Maps errors to `{ error }` replies. `onInternal` (e.g. Sentry's captureException) is called only on the
 * real 500 path, so AppErrors (401/402/403/409/428/429/451), validation failures and other 4xx never reach it.
 */
export function registerErrorHandler(app: FastifyInstance, onInternal?: (err: unknown) => void): void {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) return reply.status(err.status).send({ error: err.code })
    if (err instanceof ZodError) return reply.status(400).send({ error: 'INVALID_ACTION' })
    if (typeof (err as { statusCode?: number }).statusCode === 'number' && (err as { statusCode: number }).statusCode < 500) {
      return reply.status((err as { statusCode: number }).statusCode).send({ error: 'BAD_REQUEST' })
    }
    app.log.error(err)
    try {
      onInternal?.(err)
    } catch (reportErr) {
      app.log.error({ err: reportErr }, 'error reporter failed')
    }
    return reply.status(500).send({ error: 'INTERNAL' })
  })
  app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: 'NOT_FOUND' }))
}
