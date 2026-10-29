import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { AppError, registerErrorHandler } from '../src/plugins/errors'
import { testApp, type TestApp } from './helpers/testApp'

let t: TestApp | undefined
afterEach(async () => { await t?.close(); t = undefined })

describe('internal error reporting (Sentry hook)', () => {
  it('reports only real 500s, never AppError or validation failures', async () => {
    const capture = vi.fn()
    const app = Fastify()
    registerErrorHandler(app, capture)
    app.get('/unauth', async () => { throw new AppError(401, 'UNAUTHORIZED') })
    app.get('/limited', async () => { throw new AppError(429, 'RATE_LIMITED') })
    app.get('/blocked', async () => { throw new AppError(451, 'REGION_BLOCKED') })
    app.get('/zod', async () => z.object({ a: z.string() }).parse({}))
    app.get('/bad', { schema: { querystring: { type: 'object', required: ['q'], properties: { q: { type: 'string' } } } } }, async () => 'ok')
    app.get('/boom', async () => { throw new Error('kaboom') })
    await app.ready()

    expect((await app.inject({ url: '/unauth' })).statusCode).toBe(401)
    expect((await app.inject({ url: '/limited' })).statusCode).toBe(429)
    expect((await app.inject({ url: '/blocked' })).statusCode).toBe(451)
    expect((await app.inject({ url: '/zod' })).statusCode).toBe(400)
    expect((await app.inject({ url: '/bad' })).statusCode).toBe(400)
    expect(capture).not.toHaveBeenCalled()

    const res = await app.inject({ url: '/boom' })
    expect(res.statusCode).toBe(500)
    expect(res.json()).toEqual({ error: 'INTERNAL' })
    expect(capture).toHaveBeenCalledTimes(1)
    expect((capture.mock.calls[0]![0] as Error).message).toBe('kaboom')
    await app.close()
  })

  it('buildApp wires onInternalError and does not report client errors', async () => {
    const capture = vi.fn()
    t = await testApp({ onInternalError: capture }, 1_700_000_000_000)
    expect((await t.app.inject({ method: 'GET', url: '/me' })).statusCode).toBe(401)
    expect(capture).not.toHaveBeenCalled()
  })
})
