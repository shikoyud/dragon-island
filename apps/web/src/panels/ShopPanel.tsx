import {
  BREEDER_LEVELS, DECORATIONS, ISLANDS, basicHome, basicPriceGold, canLiveIn, getSpecies, LAUNCH_CATALOG, ELEMENTS, FOOD_PACK, FOOTPRINT, HABITATS, ROOST_FOOTPRINT, ROOST_TIERS, farmBuildGold, MAX_FARMS, priceMicroUsd, unlockPl,
  type DecorationId, type Footprint, type IslandId, type PlayerState, type SkipTarget, type StoreItem, type UnlockKey,
} from '@wyrmhaven/game-core'
import { memo, useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Placing } from '../game/bridge'
import { breederName } from '../hud/hudModel'
import { hasLegalCell } from '../state/placing'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { formatGold, formatMicroUsd, formatSkipPrice } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'
import { clearingLabel } from '../ui/obstacleNames'
import { Timer } from '../ui/Timer'

export type ShopTab = 'build' | 'store'

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)
/** "flowerPatch" -> "Flower patch". */
const decorationName = (id: DecorationId) => cap(id.replace(/([A-Z])/g, ' $1').toLowerCase())
const NO_ROOM = 'No room: clear or buy land'

/**
 * Whether each decoration has a legal cell. One scan per footprint (a decoration of the same size has the same cells), and
 * none for an item of another island, whose row already says `<Island> only`.
 */
function decorationRoom(s: PlayerState, view: IslandId): Record<DecorationId, boolean> {
  const bySize = new Map<number, boolean>()
  const out = {} as Record<DecorationId, boolean>
  for (const id of Object.keys(DECORATIONS) as DecorationId[]) {
    const d = DECORATIONS[id]
    if (d.island && d.island !== view) { out[id] = true; continue }
    const key = d.size + (d.island ? 10 : 0)
    if (!bySize.has(key)) bySize.set(key, hasLegalCell(s, { kind: 'decoration', decoration: id }))
    out[id] = bySize.get(key)!
  }
  return out
}

export interface ShopPanelProps {
  onPlace: (what: Placing['what'], size: Footprint) => void
  view: IslandId
  nowMs: number
  /** The tab to open on; Build by default. The resource pills' "+" open the Store tab. */
  tab?: ShopTab
  onClose?: () => void
}

/**
 * The Shop: Build (everything that goes on the grid, paid in Gold) and Store (USD-priced items paid in DRIS from the
 * game balance: skips, the food pack, level 5 upgrades and the Golden Aerie). Cards that place something start placement.
 */
export function ShopPanel({ onPlace, view, nowMs, tab: initial = 'build', onClose }: ShopPanelProps) {
  const me = useMe()
  const [tab, setTab] = useState<ShopTab>(initial)
  const s = me.data?.state
  // One scan for the habitat rows (the Golden Aerie shares the footprint), one each for the Grove and the Roost; not tied to the clock.
  const { room, groveRoom, roostRoom, farmRoom, decoRoom } = useMemo(
    () => ({
      room: s ? hasLegalCell(s, { kind: 'habitat', element: 'terra' }) : false,
      groveRoom: s ? hasLegalCell(s, { kind: 'grove' }) : false,
      roostRoom: s ? hasLegalCell(s, { kind: 'roost' }) : false,
      farmRoom: s ? hasLegalCell(s, { kind: 'farm' }) : false,
      decoRoom: s ? decorationRoom(s, view) : ({} as Record<DecorationId, boolean>),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, s?.islands, s?.habitats, s?.breeders, s?.farms, s?.decorations, s?.hatcheryPlacement, s?.roostPlacement, s?.constructions],
  )
  // The host passes a new onPlace every render; the rows call the latest through one that stays the same, so the Build tab, which reads no clock, sits out the tick.
  const latestPlace = useRef(onPlace)
  latestPlace.current = onPlace
  const place = useCallback<ShopPanelProps['onPlace']>((what, size) => latestPlace.current(what, size), [])
  if (!s) return null
  return (
    <Panel title="Shop" onClose={onClose}>
      <div className="hud-tabs" role="tablist" aria-label="Shop sections">
        <button type="button" role="tab" className="hud-tab" aria-selected={tab === 'build'} onClick={() => setTab('build')}>Build</button>
        <button type="button" role="tab" className="hud-tab" aria-selected={tab === 'store'} onClick={() => setTab('store')}>Store</button>
      </div>
      <div role="tabpanel" aria-label={tab === 'build' ? 'Build' : 'Store'}>
        {tab === 'build' ? <BuildTab s={s} onPlace={place} view={view} room={room} groveRoom={groveRoom} roostRoom={roostRoom} farmRoom={farmRoom} decoRoom={decoRoom} /> : <StoreTab s={s} nowMs={nowMs} onPlace={onPlace} room={room} />}
      </div>
    </Panel>
  )
}

const section = (key: string, title: string, items: ReactNode) => (
  <section data-testid={`shop-${key}`} style={{ marginBottom: 10 }}>
    <h3 style={{ fontSize: 12 }}>{title}</h3>
    <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6 }}>{items}</ul>
  </section>
)

/** Gold-and-level shop for everything that goes on the grid (spec section 8). */
const BuildTab = memo(function BuildTab({ s, onPlace, view, room, groveRoom, roostRoom, farmRoom, decoRoom }: { s: PlayerState; onPlace: ShopPanelProps['onPlace']; view: IslandId; room: boolean; groveRoom: boolean; roostRoom: boolean; farmRoom: boolean; decoRoom: Record<DecorationId, boolean> }) {
  const card = (id: string, label: string, price: string, reason: string | undefined, what: Placing['what'], size: Footprint) => (
    <li key={id}>
      <ActionButton id={`shop-${id}`} disabled={Boolean(reason)} reason={reason} onClick={() => onPlace(what, size)}>
        {label} · {price}
      </ActionButton>
    </li>
  )
  const gold = (cost: number, minLevel: number, other?: string) =>
    s.level < minLevel ? `Level ${minLevel}` : other ?? (s.gold < cost ? 'Not enough gold' : undefined)

  const { run, pending } = useAction()
  const noRoom = room ? undefined : NO_ROOM
  const plots = s.farms.length
  const grove = BREEDER_LEVELS.grove[0]!
  const roost = ROOST_TIERS[0]!
  const groveBuilt = s.breeders.some(b => b.kind === 'grove')
  return (
    <>
      {section('dragons', 'Dragons', ELEMENTS.map(el => {
        const basicPl = unlockPl(`basic:${el}`)
        const price = basicPriceGold(el)
        // The engine's order: Player Level, then a finished habitat with room (R26), then Gold.
        const reason = s.level < basicPl ? `Level ${basicPl}`
          : !basicHome(s, LAUNCH_CATALOG, el) ? (s.habitats.some(h => canLiveIn(getSpecies(LAUNCH_CATALOG, el), h)) ? `No free ${cap(el)} habitat` : `Build a ${cap(el)} habitat first`)
          : s.gold < price ? 'Not enough gold' : undefined
        return (
          <li key={el}>
            <ActionButton id={`shop-basic-${el}`} disabled={Boolean(reason) || pending} reason={reason} onClick={() => void run({ type: 'buyBasic', element: el })}>
              {cap(el)} Basic · {formatGold(price)} gold
            </ActionButton>
          </li>
        )
      }))}
      {section('habitats', 'Habitats', <>
        {ELEMENTS.map(el => {
          const { buildGold } = HABITATS[el]
          return card(`habitat-${el}`, `${cap(el)} habitat`, `${formatGold(buildGold)} gold`,
            gold(buildGold, unlockPl(`habitat:${el}`), noRoom), { kind: 'habitat', element: el }, FOOTPRINT.habitat)
        })}
      </>)}
      {section('breeding', 'Breeding', card('grove', breederName('grove'), `${formatGold(grove.gold!)} gold`,
        gold(grove.gold!, unlockPl('grove:1'), groveBuilt ? 'Already built' : groveRoom ? undefined : NO_ROOM), { kind: 'grove' }, FOOTPRINT.breeder))}
      {section('roost', 'Roost', card('roost', 'Dragon Roost', `${formatGold(roost.gold)} gold`,
        gold(roost.gold, unlockPl('roost:1'), s.roostPlacement ? 'Already built' : roostRoom ? undefined : NO_ROOM), { kind: 'roost' }, ROOST_FOOTPRINT))}
      {section('farming', 'Farming', card('farm', 'Farm plot', plots >= MAX_FARMS ? 'maximum' : `${formatGold(farmBuildGold(plots + 1))} gold`,
        plots >= MAX_FARMS ? 'Maximum plots reached' : gold(farmBuildGold(plots + 1), unlockPl(`farm:${plots + 1}` as UnlockKey), farmRoom ? undefined : NO_ROOM), { kind: 'farm' }, FOOTPRINT.farm))}
      {section('decorations', 'Decorations', (Object.keys(DECORATIONS) as DecorationId[]).map(id => {
        const d = DECORATIONS[id]
        // Locked items stay visible, greyed (spec section 8): an item for one island says so anywhere else.
        const reason = d.island && d.island !== view ? `${ISLANDS[d.island].name} only` : gold(d.cost, d.minLevel, decoRoom[id] ? undefined : NO_ROOM)
        return card(`deco-${id}`, decorationName(id), `${formatGold(d.cost)} gold`, reason, { kind: 'decoration', decoration: id }, d.size)
      }))}
    </>
  )
})

interface TimerRow { id: string; label: string; target: SkipTarget; index: number; readyAtMs: number }

/** Every running timer that can be skipped, in the order the player meets them. */
function runningTimers(s: PlayerState): TimerRow[] {
  const rows: TimerRow[] = []
  s.constructions.forEach((c, i) => rows.push({
    id: `construction-${i}`, label: c.kind === 'clear' ? clearingLabel(s, c.obstacleId) : c.kind === 'build' ? 'Building' : 'Upgrade', target: 'construction', index: i, readyAtMs: c.readyAtMs,
  }))
  s.breeders.forEach((b, i) => { if (b.egg) rows.push({ id: `breeder-${i}`, label: `${breederName(b.kind)} egg`, target: 'breeder', index: i, readyAtMs: b.egg.readyAtMs }) })
  s.hatchery.forEach((e, i) => { if (e) rows.push({ id: `hatch-${i}`, label: `Hatchery egg ${i + 1}`, target: 'hatchery', index: i, readyAtMs: e.readyAtMs }) })
  s.farms.forEach((f, i) => { if (f.crop !== null) rows.push({ id: `farm-${i}`, label: `Farm plot ${i + 1}`, target: 'farm', index: i, readyAtMs: f.readyAtMs }) })
  return rows
}

/** USD-priced items. Prices come from game-core; the DRIS charge is worked out by the server at the current rate. */
function StoreTab({ s, nowMs, onPlace, room }: { s: PlayerState; nowMs: number; onPlace: ShopPanelProps['onPlace']; room: boolean }) {
  const { run, pending } = useAction()
  const buy = (item: StoreItem) => void run({ type: 'buy', item })
  const price = (item: StoreItem) => priceMicroUsd(item, s, nowMs)

  const aerieFull = !room
  const foodPrice = price({ kind: 'foodPack' })
  const aeriePrice = price({ kind: 'goldenAerie', placement: { island: 'home', col: 0, row: 0, facing: 0 } })
  const timers = runningTimers(s).filter(t => price({ kind: 'skip', target: t.target, index: t.index }) !== null)
  const habitats = s.habitats.filter(h => price({ kind: 'habitatL5', habitatId: h.id }) !== null)
  const farms = s.farms.map((f, index) => ({ f, index })).filter(({ index }) => price({ kind: 'farmL5', index }) !== null)
  const slotPrice = price({ kind: 'hatcheryL5' })
  const groves = s.breeders.map((b, index) => ({ b, index })).filter(({ index }) => price({ kind: 'groveL3', index }) !== null)

  return (
    <>
      <p><small>Prices in USD, paid in DRIS from your game balance at the current rate.</small></p>
      {section('timers', 'Skip a timer', timers.length === 0
        ? <li><small>Nothing is running.</small></li>
        : timers.map(t => {
          const item: StoreItem = { kind: 'skip', target: t.target, index: t.index }
          return (
            <li key={t.id}>
              <ActionButton id={`skip-store-${t.id}`} disabled={pending} onClick={() => buy(item)}>
                Skip {t.label} (<Timer readyAtMs={t.readyAtMs} nowMs={nowMs} />) · {formatSkipPrice(price(item)!)}
              </ActionButton>
            </li>
          )
        }))}
      {section('food', 'Food', (
        <li>
          <ActionButton id="buy-food-pack" disabled={pending || foodPrice === null} reason={foodPrice === null ? 'Not available right now' : undefined} onClick={() => buy({ kind: 'foodPack' })}>
            Food pack · {formatGold(FOOD_PACK)} food{foodPrice !== null ? ` · ${formatMicroUsd(foodPrice)}` : ''}
          </ActionButton>
        </li>
      ))}
      {section('level5', 'Level 5 upgrades', habitats.length + farms.length + groves.length === 0 && slotPrice === null
        ? <li><small>Level 4 habitats and farm plots can be upgraded to level 5 here, instantly.</small></li>
        : <>
          {slotPrice !== null && (
            <li>
              <ActionButton id="buy-hatchery-l5" disabled={pending} onClick={() => buy({ kind: 'hatcheryL5' })}>
                Hatchery · 5th slot · {formatMicroUsd(slotPrice)}
              </ActionButton>
            </li>
          )}
          {groves.map(({ index }) => {
            const item: StoreItem = { kind: 'groveL3', index }
            return (
              <li key={`grove-${index}`}>
                <ActionButton id={`buy-grove-l3-${index}`} disabled={pending} onClick={() => buy(item)}>
                  Grove · Level 3 · {formatMicroUsd(price(item)!)}
                </ActionButton>
              </li>
            )
          })}
          {habitats.map(h => {
            const item: StoreItem = { kind: 'habitatL5', habitatId: h.id }
            return (
              <li key={h.id}>
                <ActionButton id={`buy-habitat-l5-${h.id}`} disabled={pending} onClick={() => buy(item)}>
                  Level 5 · {cap(h.element)} habitat {h.id} · {formatMicroUsd(price(item)!)}
                </ActionButton>
              </li>
            )
          })}
          {farms.map(({ index }) => {
            const item: StoreItem = { kind: 'farmL5', index }
            return (
              <li key={`farm-${index}`}>
                <ActionButton id={`buy-farm-l5-${index}`} disabled={pending} onClick={() => buy(item)}>
                  Level 5 · Farm plot {index + 1} · {formatMicroUsd(price(item)!)}
                </ActionButton>
              </li>
            )
          })}
        </>)}
      {aeriePrice !== null && section('aerie', 'Golden Aerie', (
        <li>
          <ActionButton id="buy-golden-aerie" disabled={aerieFull} reason={aerieFull ? NO_ROOM : 'Not available right now'} onClick={() => onPlace({ kind: 'goldenAerie' }, FOOTPRINT.habitat)}>
            Golden Aerie · {formatMicroUsd(aeriePrice)}
          </ActionButton>
          <small style={{ display: 'block', color: 'var(--text-muted)' }}>A level 5 habitat for any element. You pick the spot, then confirm. One per player.</small>
        </li>
      ))}
    </>
  )
}
