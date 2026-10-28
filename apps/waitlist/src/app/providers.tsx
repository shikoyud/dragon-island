'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { WagmiProvider } from 'wagmi'
import { initWallet, wagmiConfig } from '../wallet/config'

/** wagmi + react-query for the wallet step; AppKit's modal is created in the browser only. */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  useEffect(() => {
    initWallet()
  }, [])
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
