export function Header({ xHandle }: { xHandle: string }) {
  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <a className="wordmark" href="#top" aria-label="Wyrmhaven home">
          <span className="wordmark-gem" aria-hidden="true" />
          Wyrmhaven
        </a>
        <nav className="header-nav" aria-label="Sections">
          <a href="#game">Game</a>
          <a href="#elements">Elements</a>
          <a href="#faq">FAQ</a>
          <a href={`https://x.com/${encodeURIComponent(xHandle)}`} target="_blank" rel="noopener noreferrer">
            X
          </a>
        </nav>
        <a className="btn btn-primary btn-small" href="#join">
          Join
        </a>
      </div>
    </header>
  )
}
