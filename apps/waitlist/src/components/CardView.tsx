import { cardImagePath } from '../card/cardUrl'
import { Panel } from './Panel'

/** The public `/c/<code>` page body: a joined entrant's card and an invite to join with their ref. */
export function CardView({ code, handle, position }: { code: string; handle: string; position: number }) {
  return (
    <>
      <header className="site-header">
        <div className="wrap header-inner">
          <a className="wordmark" href="/" aria-label="Dragon Island home">
            <span className="wordmark-gem" aria-hidden="true" />
            Dragon Island
          </a>
        </div>
      </header>
      <main className="section wrap wrap-narrow card-page">
        <Panel className="waitlist-panel joined">
          <p className="joined-kicker">On the waitlist</p>
          <h1 className="card-page-title">
            @{handle} is #{position}
          </h1>
          <img
            className="joined-card"
            src={cardImagePath(code)}
            alt={`Dragon Island card for @${handle}, #${position}`}
            width={1200}
            height={675}
          />
          <p className="step-text card-page-pitch">Breed dragons. Build your island. Battle for the season.</p>
          <a className="btn btn-primary btn-big" href={`/?ref=${encodeURIComponent(code)}#join`}>
            Join the waitlist
          </a>
        </Panel>
      </main>
    </>
  )
}
