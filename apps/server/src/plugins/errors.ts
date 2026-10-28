import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'

/** Typed failure that maps straight to an HTTP status and `{ error }` body (spec §19). */
export class AppError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(code)
  }
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) return reply.status(err.status).send({ error: err.code })
    if (err instanceof ZodError) return reply.status(400).send({ error: 'INVALID_ACTION' })
    if (typeof (err as { statusCode?: number }).statusCode === 'number' && (err as { statusCode: number }).statusCode < 500) {
      return reply.status((err as { statusCode: number }).statusCode).send({ error: 'BAD_REQUEST' })
    }
    app.log.error(err)
    return reply.status(500).send({ error: 'INTERNAL' })
  })
  app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: 'NOT_FOUND' }))
}
