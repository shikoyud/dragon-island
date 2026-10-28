export function Footer({ xHandle }: { xHandle: string }) {
  return (
    <footer className="site-footer">
      <div className="wrap footer-inner">
        <div>
          <p className="wordmark wordmark-small">Wyrmhaven</p>
          <p className="footer-note">Built for Robinhood Chain testnet.</p>
        </div>
        <p className="footer-note">
          Privacy: we keep your X handle, name and avatar, your wallet address and your task times, only to run this
          waitlist. We never post for you.
        </p>
        <nav aria-label="Social">
          <a href={`https://x.com/${encodeURIComponent(xHandle)}`} target="_blank" rel="noopener noreferrer">
            @{xHandle} on X
          </a>
        </nav>
      </div>
    </footer>
  )
}
