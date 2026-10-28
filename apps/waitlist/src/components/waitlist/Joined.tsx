'use client'

import { useState } from 'react'
import type { EntrantState } from '../../server/entrants'

export function shareText(position: number): string {
  return `I'm #${position} on the Wyrmhaven waitlist. Breed dragons. Build your island. Battle for the season.`
}

export function Joined({ state, siteUrl }: { state: EntrantState; siteUrl: string }) {
  const [copied, setCopied] = useState(false)
  const [downloadErr, setDownloadErr] = useState(false)
  const code = encodeURIComponent(state.refCode)
  const cardSrc = `/api/card/${code}.png`
  const site = (siteUrl || (typeof window === 'undefined' ? '' : window.location.origin)).replace(/\/+$/, '')
  const cardPage = `${site}/c/${code}`
  const invite = `${site}/?ref=${code}`
  const postHref = `https://x.com/intent/post?text=${encodeURIComponent(shareText(state.position!))}&url=${encodeURIComponent(cardPage)}`

  async function download() {
    setDownloadErr(false)
    try {
      const res = await fetch(cardSrc)
      if (!res.ok) throw new Error(String(res.status))
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = `wyrmhaven-${state.handle}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setDownloadErr(true)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(invite)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy your invite link', invite)
    }
  }

  return (
    <div className="step joined">
      <p className="joined-kicker">You are on the list</p>
      <h3 className="joined-number">#{state.position}</h3>
      <img className="joined-card" src={cardSrc} alt={`Wyrmhaven card for @${state.handle}`} width={1200} height={675} />
      <div className="joined-actions">
        <button type="button" className="btn" onClick={() => void download()}>
          Download
        </button>
        <a className="btn btn-primary" href={postHref} target="_blank" rel="noopener noreferrer">
          Post on X
        </a>
        <button type="button" className="btn" onClick={() => void copy()}>
          {copied ? 'Copied!' : 'Copy invite link'}
        </button>
      </div>
      {downloadErr ? (
        <p className="notice notice-warn" role="alert">
          Could not download the card. Try again in a moment.
        </p>
      ) : null}
      <p className="joined-invites">
        {state.inviteCount === 1 ? '1 friend has' : `${state.inviteCount} friends have`} joined with your invite link.
      </p>
    </div>
  )
}
