import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode, type ReactElement, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { ApiProvider } from './api/ApiProvider'
import { createApi } from './api/client'
import { sessionStore } from './api/session'
import { App } from './App'
import { ME_KEY } from './state/me'
import './styles/tokens.css'

// Error reporting only when a DSN is configured; without one the SDK is never downloaded.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
if (sentryDsn) {
  void import('@sentry/react').then(Sentry => Sentry.init({ dsn: sentryDsn, environment: import.meta.env.MODE }))
}

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })

const api = createApi({
  baseUrl: import.meta.env.VITE_API_URL ?? '/api',
  getToken: () => sessionStore.get()?.token ?? null,
  onUnauthorized: () => {
    sessionStore.clear()
    queryClient.clear() // nothing cached belongs to the next sign-in
  },
  // The terms changed mid-session: /me carries termsRequired, which shows the prompt.
  onTermsRequired: () => { void queryClient.invalidateQueries({ queryKey: ME_KEY }) },
})

/** Playwright runs with a deterministic in-page wallet; everything else uses Reown AppKit + wagmi. */
async function walletRoot(): Promise<(p: { children: ReactNode }) => ReactElement> {
  if (import.meta.env.VITE_TEST_WALLET === '1') {
    const { TestWalletRoot } = await import('./wallet/testWallet')
    return TestWalletRoot
  }
  const [{ WalletRoot }, { WagmiVaultProvider }] = await Promise.all([import('./wallet/config'), import('./chain/wagmiVault')])
  return ({ children }) => <WalletRoot queryClient={queryClient}><WagmiVaultProvider>{children}</WagmiVaultProvider></WalletRoot>
}

void walletRoot().then(Root => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ApiProvider api={api}>
          <Root><App /></Root>
        </ApiProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
})
