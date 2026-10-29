import { ACTIVE_ART } from '../art/slots'
import { Sprite } from '../art/Sprite'
import { ELEMENTS } from '../domain/elements'
import { IslandScene } from './IslandScene'
import { LiveCount } from './LiveCount'

/** The hero art slot: generated sprite layers when present, else the pixel-grid island. */
function HeroArt() {
  const { base, layers } = ACTIVE_ART.hero
  if (!base.src) return <IslandScene />
  // Two whole-number scales, swapped by CSS at the desktop breakpoint.
  return (
    <>
      {[1, 2].map((scale) => (
        <div key={scale} className={`hero-sprite hero-sprite-x${scale}`}>
          <Sprite sprite={base} element="water" scale={scale} />
          {layers.map((l, i) => (
            <div key={i} className="hero-layer">
              <Sprite sprite={l} element="water" scale={scale} />
            </div>
          ))}
        </div>
      ))}
    </>
  )
}

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="kicker">An original pixel dragon game</p>
        <h1 id="hero-title" className="hero-title">
          Dragon Island
        </h1>
        <p className="hero-pitch">Breed dragons. Build your island. Battle for the season.</p>
        <div className="hero-cta">
          <a className="btn btn-primary btn-big" href="#join">
            Join the waitlist
          </a>
          <LiveCount />
        </div>
      </div>

      <div className="hero-scene">
        <div className="cloud cloud-a" aria-hidden="true" />
        <div className="cloud cloud-b" aria-hidden="true" />
        <div className="hero-art">
          <HeroArt />
        </div>
        <ul className="hatchlings" aria-label="The nine element hatchlings">
          {ELEMENTS.map((e, i) => (
            <li key={e} className="hatch" style={{ animationDelay: `${(i % 3) * 0.25}s` }}>
              <Sprite sprite={ACTIVE_ART.hatchling[e]} element={e} scale={1} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
