import { ACTIVE_ART } from '../art/slots'
import { Sprite } from '../art/Sprite'
import type { Sprite as SpriteData } from '../art/types'
import type { Element } from '../domain/elements'
import { Panel } from './Panel'

const PILLARS: { title: string; text: string; element: Element; sprite: SpriteData }[] = [
  {
    title: 'Breed',
    text: 'Raise your dragons, pair them up in nests and hatch their eggs. Every pairing is a chance at something new.',
    element: 'flame',
    sprite: ACTIVE_ART.egg.flame,
  },
  {
    title: 'Build',
    text: 'Grow a floating island of element habitats. Habitats make gold, farms turn gold into food, and food levels up your dragons.',
    element: 'nature',
    sprite: ACTIVE_ART.elementIcon.nature,
  },
  {
    title: 'Battle',
    text: 'Pick three dragons and fight 3v3, turn by turn. You choose every move, so element matchups decide the fight.',
    element: 'electric',
    sprite: ACTIVE_ART.elementIcon.electric,
  },
  {
    title: 'Ranked',
    text: 'The game runs once, for 14 or 28 days, and then shuts down. Win ranked battles and climb the ladder. $DRIS, the planned tradable token, is tied to ranked play and depends on legal review.',
    element: 'light',
    sprite: ACTIVE_ART.elementIcon.light,
  },
]

export function Pillars() {
  return (
    <section id="game" className="section wrap" aria-labelledby="game-title">
      <h2 id="game-title" className="section-title">
        Raise a haven of dragons
      </h2>
      <ul className="pillars">
        {PILLARS.map((p) => (
          <li key={p.title}>
            <Panel className={`pillar el-accent-${p.element}`}>
              <span className="pillar-icon">
                <Sprite sprite={p.sprite} element={p.element} scale={2} />
              </span>
              <h3 className="pillar-title">{p.title}</h3>
              <p className="pillar-text">{p.text}</p>
            </Panel>
          </li>
        ))}
      </ul>
    </section>
  )
}
