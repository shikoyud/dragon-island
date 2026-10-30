import { ACTIVE_ART } from '../art/slots'
import { Sprite } from '../art/Sprite'
import { ELEMENTS } from '../domain/elements'

export function ElementsStrip() {
  return (
    <section id="elements" className="section wrap" aria-labelledby="elements-title">
      <h2 id="elements-title" className="section-title">
        Ten elements
      </h2>
      <p className="section-lead">
        Every dragon carries an element, and every element is strong against others. Learn the matchups and build your
        team around them. Your starting element comes from your X account when you join.
      </p>
      <ul className="elements">
        {ELEMENTS.map((e) => (
          <li key={e} className={`element el-accent-${e}`}>
            <Sprite sprite={ACTIVE_ART.elementIcon[e]} element={e} scale={1} />
            <span className="element-name">{e}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
