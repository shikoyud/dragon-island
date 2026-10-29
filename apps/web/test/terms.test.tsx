import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../src/api/ApiProvider'
import { createApi, type Api } from '../src/api/client'
import { messageFor } from '../src/api/errors'
import { ME_KEY } from '../src/state/me'
import { ToastProvider } from '../src/ui/Toast'
import { TermsPrompt } from '../src/ui/TermsPrompt'

describe('region and terms copy', () => {
  it('maps REGION_BLOCKED and TERMS_REQUIRED to plain copy that promises nothing', () => {
    expect(messageFor('REGION_BLOCKED')).toBe('Dragon Island isn’t available in your region.')
    expect(messageFor('TERMS_REQUIRED')).toMatch(/accept the updated terms/i)
    expect(messageFor('TERMS_VERSION_MISMATCH')).toMatch(/reload/i)
    for (const code of ['REGION_BLOCKED', 'TERMS_REQUIRED', 'TERMS_VERSION_MISMATCH']) expect(messageFor(code)).not.toMatch(/earn|profit|income/i)
  })
})

describe('createApi', () => {
  it('reports TERMS_REQUIRED replies and posts acceptance to /me/terms', async () => {
    const calls: string[] = []
    const fetchImpl = (async (url: RequestInfo | URL, init: RequestInit = {}) => {
      calls.push(`${init.method} ${String(url)} ${String(init.body ?? '')}`)
      return String(url).endsWith('/actions')
        ? new Response(JSON.stringify({ error: 'TERMS_REQUIRED' }), { status: 428 })
        : new Response(JSON.stringify({ ok: true }), { status: 200 })
    }) as typeof fetch
    const onTermsRequired = vi.fn()
    const api = createApi({ baseUrl: '/api', getToken: () => 't', onUnauthorized: () => {}, onTermsRequired, fetchImpl })
    await expect(api.action({ type: 'harvest', plot: 0 }, 'k')).rejects.toMatchObject({ status: 428, code: 'TERMS_REQUIRED' })
    expect(onTermsRequired).toHaveBeenCalledTimes(1)
    await api.acceptTerms('2026-11')
    expect(calls.at(-1)).toBe('POST /api/me/terms {"version":"2026-11"}')
  })
})

describe('TermsPrompt', () => {
  function setup(links: { terms?: string; privacy?: string; risk?: string }) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const api = { acceptTerms: vi.fn(async () => ({ ok: true as const })) }
    render(
      <QueryClientProvider client={qc}>
        <ApiProvider api={api as unknown as Api}>
          <ToastProvider><TermsPrompt version="2026-11" links={links} /></ToastProvider>
        </ApiProvider>
      </QueryClientProvider>,
    )
    return { api, invalidate }
  }

  it('links only the pages that are configured', () => {
    setup({ terms: 'https://example.com/terms', risk: 'https://example.com/risk' })
    expect(screen.getByRole('link', { name: /terms of service/i })).toHaveAttribute('href', 'https://example.com/terms')
    expect(screen.getByRole('link', { name: /risk/i })).toHaveAttribute('href', 'https://example.com/risk')
    expect(screen.queryByRole('link', { name: /privacy/i })).toBeNull()
  })

  it('accepts the required version and refreshes /me', async () => {
    const { api, invalidate } = setup({})
    await userEvent.click(screen.getByRole('button', { name: /accept/i }))
    expect(api.acceptTerms).toHaveBeenCalledWith('2026-11')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ME_KEY })
  })
})
