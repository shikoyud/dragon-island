import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ApiProvider } from './api/ApiProvider'
import { createApi } from './api/client'
import { sessionStore } from './api/session'
import { App } from './App'
import './styles/tokens.css'
import { WalletRoot } from './wallet/config'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })

const api = createApi({
  baseUrl: import.meta.env.VITE_API_URL ?? '/api',
  getToken: () => sessionStore.get()?.token ?? null,
  onUnauthorized: () => {
    sessionStore.clear()
    queryClient.removeQueries({ queryKey: ['me'] })
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ApiProvider api={api}>
        <WalletRoot queryClient={queryClient}>
          <App />
        </WalletRoot>
      </ApiProvider>
    </QueryClientProvider>
  </StrictMode>,
)
