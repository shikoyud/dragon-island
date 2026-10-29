import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useApi } from '../api/ApiProvider'
import { ME_KEY } from '../state/me'
import { Panel } from './Panel'
import { useToasts } from './Toast'

export interface TermsLinks { terms?: string; privacy?: string; risk?: string }

/** Legal pages are hosted outside the app; a link whose build variable is unset is not shown. */
export const TERMS_LINKS: TermsLinks = {
  terms: (import.meta.env.VITE_TERMS_URL as string | undefined) || undefined,
  privacy: (import.meta.env.VITE_PRIVACY_URL as string | undefined) || undefined,
  risk: (import.meta.env.VITE_RISK_URL as string | undefined) || undefined,
}

/**
 * Shown while /me reports `termsRequired`. Gameplay answers 428 until the player accepts; the wallet
 * and their state stay reachable. Accepting posts the exact version, then reloads /me.
 */
export function TermsPrompt({ version, links = TERMS_LINKS }: { version: string; links?: TermsLinks }) {
  const api = useApi()
  const qc = useQueryClient()
  const toasts = useToasts()
  const [pending, setPending] = useState(false)
  const pages = [
    { href: links.terms, label: 'Terms of Service' },
    { href: links.privacy, label: 'Privacy Policy' },
    { href: links.risk, label: 'Risk Disclosure' },
  ].filter((p): p is { href: string; label: string } => !!p.href)

  const accept = async () => {
    setPending(true)
    try {
      await api.acceptTerms(version)
      await qc.invalidateQueries({ queryKey: ME_KEY })
    } catch (e) {
      toasts.error(e)
      // A TERMS_VERSION_MISMATCH means the server moved to a newer version: reload /me so the prompt
      // offers that one instead of the stale version forever. Harmless for other failures.
      void qc.invalidateQueries({ queryKey: ME_KEY })
    } finally {
      setPending(false)
    }
  }

  return (
    <Panel title="Updated terms">
      <p>Please read and accept the current terms to keep playing. You can still view your island and use your wallet.</p>
      {pages.length > 0 && (
        <ul>
          {pages.map(p => <li key={p.label}><a href={p.href} target="_blank" rel="noopener noreferrer">{p.label}</a></li>)}
        </ul>
      )}
      <button type="button" className="btn btn--primary" disabled={pending} onClick={() => void accept()}>Accept</button>
    </Panel>
  )
}
