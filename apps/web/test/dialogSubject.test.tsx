import { newPlayer, type PlayerState } from '@wyrmhaven/game-core'
import { act, cleanup, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createBridge } from '../src/game/bridge'
import { Dialog } from '../src/hud/Dialog'
import type { DialogKey } from '../src/hud/Hud'
import { dialogHasSubject, dialogLabel, PanelHost, useDialog } from '../src/panels/PanelHost'
import { harness } from './harness'
import { FREE, withPlots } from './land'

const base = newPlayer(0)
const obstacle = { id: 'o1', kind: 'bush' as const, island: 'home' as const, col: FREE.col, row: FREE.row }
const full: PlayerState = {
  ...withPlots(base, [5, 6, 9, 10]),
  islands: { ...withPlots(base, [5, 6, 9, 10]).islands, obstacles: [obstacle] },
  decorations: [{ id: 'c1', kind: 'hayCart', placement: { island: 'home', col: 0, row: 0, facing: 0 } }],
  roostPlacement: { island: 'home', col: 0, row: 0, facing: 0 },
}
const target = (t: Extract<DialogKey, { kind: 'target' }>['target']): DialogKey => ({ kind: 'target', target: t })
const GAME = { launchAtMs: 0 }

/** Every panel whose subject can vanish: the key that opens it, and the state after the subject has gone. */
const VANISHING: { name: string; key: DialogKey; gone: PlayerState }[] = [
  { name: 'obstacle cleared', key: target({ kind: 'obstacle', id: 'o1' }), gone: { ...full, islands: { ...full.islands, obstacles: [] } } },
  { name: 'dragon sold', key: target({ kind: 'dragon', id: full.dragons[0]!.id }), gone: { ...full, dragons: full.dragons.slice(1) } },
  { name: 'habitat sold', key: target({ kind: 'habitat', id: full.habitats[0]!.id }), gone: { ...full, habitats: full.habitats.slice(1) } },
  { name: 'decoration removed', key: target({ kind: 'decoration', id: 'c1' }), gone: { ...full, decorations: [] } },
  { name: 'farm gone', key: target({ kind: 'farm', plot: 0 }), gone: { ...full, farms: [] } },
  { name: 'roost gone', key: target({ kind: 'roost' }), gone: { ...full, roostPlacement: null } },
  { name: 'plot bought', key: target({ kind: 'plot', island: 'home', plot: 1 }), gone: withPlots(full, [1, 5, 6, 9, 10]) },
]
/** Panels with no subject to lose: they always have something to show. */
const LASTING: DialogKey[] = [
  { kind: 'panel', id: 'shop' }, { kind: 'panel', id: 'breed' }, { kind: 'panel', id: 'book' }, { kind: 'panel', id: 'battle' },
  { kind: 'panel', id: 'quests' },
  target({ kind: 'breeder', index: 0 }), target({ kind: 'hatchery', slot: 0 }), target({ kind: 'hatcheryBuilding' }), target({ kind: 'mapIsland', id: 'isle2' }),
]

/** The App's wiring: a Dialog around PanelHost whenever `useDialog` has one open. */
function Host({ initial }: { initial: DialogKey }) {
  const bridge = useBridge()
  const [dialog, setDialog] = useDialog(bridge, initial)
  return dialog ? <Dialog label={dialogLabel(dialog)} onClose={() => setDialog(null)}><PanelHost bridge={bridge} nowMs={0} dialog={dialog} onOpen={setDialog} /></Dialog> : null
}
const shared = createBridge()
const useBridge = () => shared

afterEach(cleanup)

describe('a dialog closes when its panel has nothing to show', () => {
  for (const { name, key, gone } of VANISHING) {
    it(`${name}: panel, scrim and dialog all go`, async () => {
      const h = harness(full, 0, undefined, GAME)
      h.wrap(<Host initial={key} />)
      expect(screen.getByRole('dialog')).not.toBeEmptyDOMElement()
      expect(screen.getByTestId('dialog-scrim')).toBeInTheDocument()
      h.setState(gone)
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(screen.queryByTestId('dialog-scrim')).toBeNull()
    })

    it(`${name}: the subject check agrees with what the panel renders`, () => {
      expect(dialogHasSubject(full, key, GAME)).toBe(true)
      expect(dialogHasSubject(gone, key, GAME)).toBe(false)
      const h = harness(gone, 0, undefined, GAME)
      const { container } = h.wrap(<PanelHost bridge={shared} nowMs={0} dialog={key} onOpen={() => {}} />)
      expect(container.querySelector('.panel')).toBeNull()
    })
  }

  it('it stays closed when the state changes again', async () => {
    const h = harness(full, 0, undefined, GAME)
    h.wrap(<Host initial={VANISHING[0]!.key} />)
    h.setState(VANISHING[0]!.gone)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    h.setState(full) // the same id coming back must not reopen a panel the player no longer has
    await new Promise(r => setTimeout(r, 20))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  for (const key of LASTING) {
    it(`${dialogLabel(key)} (${key.kind === 'panel' ? key.id : key.kind === 'target' ? key.target.kind : key.target.type}) always has something to show`, () => {
      expect(dialogHasSubject(full, key, GAME)).toBe(true)
      const h = harness(full, 0, undefined, GAME)
      h.wrap(<Host initial={key} />)
      expect(screen.getByRole('dialog')).not.toBeEmptyDOMElement()
    })
  }

  it('a tap on a plot for sale still opens its panel; Settings (wallet providers, no subject) stays open', () => {
    expect(dialogHasSubject(full, { kind: 'panel', id: 'settings' }, GAME)).toBe(true)
    const h = harness(full, 0, undefined, GAME)
    h.wrap(<Host initial={{ kind: 'panel', id: 'shop' }} />)
    act(() => shared.emit({ type: 'select', target: { kind: 'plot', island: 'home', plot: 2 } }))
    expect(screen.getByRole('dialog', { name: 'plot' })).not.toBeEmptyDOMElement()
  })
})
