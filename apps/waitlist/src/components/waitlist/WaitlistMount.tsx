'use client'

import dynamic from 'next/dynamic'
import { Panel } from '../Panel'
import type { WaitlistPanelProps } from './WaitlistPanel'

/**
 * Client-only mount for the panel and its wallet providers. AppKit/wagmi connectors pull in
 * Node-entry SDKs that cannot be bundled for SSR, and the panel needs the browser session anyway.
 */
const WaitlistWithProviders = dynamic(
  async () => {
    const [{ Providers }, { WaitlistPanel }] = await Promise.all([import('../../app/providers'), import('./WaitlistPanel')])
    return function WithProviders(props: WaitlistPanelProps) {
      return (
        <Providers>
          <WaitlistPanel {...props} />
        </Providers>
      )
    }
  },
  {
    ssr: false,
    loading: () => (
      <Panel className="waitlist-panel">
        <p className="step-text" aria-busy="true">
          Loading your progress…
        </p>
      </Panel>
    ),
  },
)

export function WaitlistMount(props: WaitlistPanelProps) {
  return <WaitlistWithProviders {...props} />
}
