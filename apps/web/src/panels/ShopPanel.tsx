import {
  BREEDER_LEVELS, DECORATIONS, ISLANDS, basicHome, basicPriceGold, canLiveIn, getSpecies, LAUNCH_CATALOG, ELEMENTS, FOOD_PACK, FOOTPRINT, HABITATS, ROOST_FOOTPRINT, ROOST_TIERS, farmBuildGold, MAX_FARMS, priceMicroUsd, unlockPl,
  type DecorationId, type Element, type Footprint, type IslandId, type PlayerState, type SkipTarget, type StoreItem, type UnlockKey,
} from '@wyrmhaven/game-core'
import { memo, useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Placing } from '../game/bridge'
import { dragonLook } from '../game/islandModel'
import { ArtMark } from '../hud/ArtMark'
import { Icon } from '../hud/Icon'
import { SpriteStill, useGameArt } from '../ui/GameArt'
import { PillButton } from '../ui/kit/buttons'
import { FullScreenFrame } from '../ui/kit/frames'
import { ElementRibbon, KitCard, ResourcePill } from '../ui/kit/pieces'
import { breederName } from '../hud/hudModel'
import { hasLegalCell } from '../state/placing'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { formatGold, formatMicroUsd, formatSkipPrice } from '../ui/Money'
import { ActionButton } from '../ui/Panel'
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

/** The Shop's six categories (design, Phase 5: shop-selected); `all` lists every build item at once. */
export type ShopCategory = 'dragons' | 'habitats' | 'buildings' | 'farms' | 'decorations' | 'store'
export type ShopView = 'home' | ShopCategory | 'all'

export const SHOP_CATEGORIES: readonly { id: ShopCategory; title: string; sections: readonly string[] }[] = [
  { id: 'dragons', title: 'Dragons', sections: ['dragons'] },
  { id: 'habitats', title: 'Habitats', sections: ['habitats'] },
  { id: 'buildings', title: 'Buildings', sections: ['breeding', 'roost'] },
  { id: 'farms', title: 'Farms', sections: ['farming'] },
  { id: 'decorations', title: 'Decorations', sections: ['decorations'] },
  { id: 'store', title: 'Store', sections: [] },
]

/** The lowest player level at which anything in the category can be bought; a card below it shows the lock (shop-selected). */
export function categoryLevel(c: ShopCategory): number {
  switch (c) {
    case 'dragons': return Math.min(...ELEMENTS.map(el => unlockPl(`basic:${el}`)))
    case 'habitats': return Math.min(...ELEMENTS.map(el => unlockPl(`habitat:${el}`)))
    case 'buildings': return Math.min(unlockPl('grove:1'), unlockPl('roost:1'))
    case 'farms': return unlockPl('farm:1')
    case 'decorations': return Math.min(...Object.values(DECORATIONS).map(d => d.minLevel))
    case 'store': return 1
  }
}

/** The plank's count badge for a category list: owned, or owned/limit. */
function categoryBadge(s: PlayerState, c: ShopCategory): string | undefined {
  switch (c) {
    case 'dragons': return `${s.dragons.length}`
    case 'habitats': return `${s.habitats.length}`
    case 'farms': return `${s.farms.length}/${MAX_FARMS}`
    case 'decorations': return `${s.decorations.length}`
    default: return undefined
  }
}

export interface ShopPanelProps {
  onPlace: (what: Placing['what'], size: Footprint) => void
  view: IslandId
  nowMs: number
  /** Legacy: `store` opens the Store category. */
  tab?: ShopTab
  /** Where it opens: the category cards (the app's default), a category, or every build item (`all`). */
  start?: ShopView
  onClose?: () => void
}

/**
 * The Shop (design, Phase 5): a home of six category cards; a category is a plank with its count, a row of item cards,
 * and a wooden footer with the resources and, for dragons and habitats, an element filter. Build items are paid in Gold
 * and start placement; the Store sells USD-priced items paid in DRIS from the game balance.
 */
export function ShopPanel({ onPlace, view, nowMs, tab: initial, start, onClose }: ShopPanelProps) {
  const me = useMe()
  const [at, setAt] = useState<ShopView>(start ?? (initial === 'store' ? 'store' : 'all'))
  const [element, setElement] = useState<Element | null>(null)
  const [strip, setStrip] = useState(false)
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
  const category = SHOP_CATEGORIES.find(c => c.id === at)
  const filtered = at === 'dragons' || at === 'habitats'
  const open = (c: ShopCategory) => { setAt(c); setElement(null); setStrip(false) }
  return (
    <FullScreenFrame title={category ? category.title : 'Shop'} badge={category ? categoryBadge(s, category.id) : undefined} backdrop={at === 'home' ? 'scene' : 'wood'}
      onBack={at !== 'home' && start !== undefined ? () => setAt('home') : undefined} onClose={onClose}>
      {at === 'home' ? (
        <ul className="shop-home" aria-label="Shop categories">
          {SHOP_CATEGORIES.map(c => {
            const level = categoryLevel(c.id)
            const locked = s.level < level
            return (
              <li key={c.id}>
                <button type="button" id={`shop-category-${c.id}`} className={`shop-category${locked ? ' shop-category--locked' : ''}`} disabled={locked}
                  aria-label={locked ? `${c.title}, level ${level}` : c.title} onClick={() => open(c.id)}>
                  <span className="shop-category__head">{c.title}</span>
                  <span className="shop-category__art"><ArtMark name={`shop.category.${c.id}`} size={96} /></span>
                  {locked && <span className="shop-category__lock">{`Level ${level}`}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="shop-list">
          {at === 'store'
            ? <StoreTab s={s} nowMs={nowMs} onPlace={onPlace} room={room} />
            : <BuildTab s={s} onPlace={place} view={view} room={room} groveRoom={groveRoom} roostRoom={roostRoom} farmRoom={farmRoom} decoRoom={decoRoom}
                only={category?.sections} element={element} />}
        </div>
      )}
      {at !== 'home' && (
        <footer className="shop-foot" aria-label="Shop footer">
          <span className="shop-foot__pills">
            <ResourcePill icon={<Icon name="gold" size={24} />} label="Gold" value={formatGold(s.gold)} />
            <ResourcePill icon={<Icon name="food" size={24} />} label="Food" value={formatGold(s.food)} />
          </span>
          {filtered && (
            <span className="shop-foot__filter">
              {element && <PillButton small color="grey" onClick={() => setElement(null)}>{`${cap(element)} ×`}</PillButton>}
              <PillButton small color="yellow" onClick={() => setStrip(v => !v)} ariaLabel="Category">Category</PillButton>
            </span>
          )}
          {filtered && strip && (
            <span className="shop-strip" role="group" aria-label="Elements">
              {ELEMENTS.map(el => (
                <button key={el} type="button" className="shop-strip__el" aria-pressed={element === el} aria-label={cap(el)} onClick={() => { setElement(el); setStrip(false) }}>
                  <ElementRibbon element={el} />
                </button>
              ))}
            </span>
          )}
        </footer>
      )}
    </FullScreenFrame>
  )
}

const section = (key: string, title: string, items: ReactNode) => (
  <section data-testid={`shop-${key}`} className="shop-section" aria-label={title}>
    <h3 className="shop-section__title">{title}</h3>
    <ul className="shop-row">{items}</ul>
  </section>
)

/** Gold-and-level shop for everything that goes on the grid (spec section 8). */
const BuildTab = memo(function BuildTab({ s, onPlace, view, room, groveRoom, roostRoom, farmRoom, decoRoom, only, element }: { s: PlayerState; onPlace: ShopPanelProps['onPlace']; view: IslandId; room: boolean; groveRoom: boolean; roostRoom: boolean; farmRoom: boolean; decoRoom: Record<DecorationId, boolean>; only?: readonly string[]; element?: Element | null }) {
  const card = (id: string, label: string, price: string, reason: string | undefined, what: Placing['what'], size: Footprint, art?: ReactNode) => (
    <li key={id}>
      <KitCard title={label} art={art} footer={(
        <ActionButton id={`shop-${id}`} disabled={Boolean(reason)} reason={reason} onClick={() => onPlace(what, size)} ariaLabel={`${label} · ${price}`}>
          {price}
        </ActionButton>
      )} />
    </li>
  )
  const shows = (key: string) => !only || only.includes(key)
  const els = element ? ELEMENTS.filter(e => e === element) : ELEMENTS
  const empty = <li className="shop-empty">Nothing here yet</li>
  const gold = (cost: number, minLevel: number, other?: string) =>
    s.level < minLevel ? `Level ${minLevel}` : other ?? (s.gold < cost ? 'Not enough gold' : undefined)

  const { run, pending } = useAction()
  const gameArt = useGameArt()
  const noRoom = room ? undefined : NO_ROOM
  const plots = s.farms.length
  const grove = BREEDER_LEVELS.grove[0]!
  const roost = ROOST_TIERS[0]!
  const groveBuilt = s.breeders.some(b => b.kind === 'grove')
  return (
    <>
      {shows('dragons') && section('dragons', 'Dragons', els.map(el => {
        const basicPl = unlockPl(`basic:${el}`)
        const price = basicPriceGold(el)
        // The engine's order: Player Level, then a finished habitat with room (R26), then Gold.
        const reason = s.level < basicPl ? `Level ${basicPl}`
          : !basicHome(s, LAUNCH_CATALOG, el) ? (s.habitats.some(h => canLiveIn(getSpecies(LAUNCH_CATALOG, el), h)) ? `No free ${cap(el)} habitat` : `Build a ${cap(el)} habitat first`)
          : s.gold < price ? 'Not enough gold' : undefined
        return (
          <li key={el}>
            <KitCard title={`${cap(el)} Basic`} elements={[el]} rarity="common" art={<SpriteStill sprite={dragonLook(el, 1, gameArt).sprite} height={64} />} footer={(
              <ActionButton id={`shop-basic-${el}`} disabled={Boolean(reason) || pending} reason={reason} onClick={() => void run({ type: 'buyBasic', element: el })} ariaLabel={`${cap(el)} Basic · ${formatGold(price)} gold`}>
                {`${formatGold(price)} gold`}
              </ActionButton>
            )} />
          </li>
        )
      }))}
      {shows('habitats') && section('habitats', 'Habitats', <>
        {els.map(el => {
          const { buildGold } = HABITATS[el]
          return card(`habitat-${el}`, `${cap(el)} habitat`, `${formatGold(buildGold)} gold`,
            gold(buildGold, unlockPl(`habitat:${el}`), noRoom), { kind: 'habitat', element: el }, FOOTPRINT.habitat, <SpriteStill sprite={gameArt.habitat[el]} height={56} />)
        })}
        {els.length === 0 && empty}
      </>)}
      {shows('breeding') && section('breeding', 'Breeding', card('grove', breederName('grove'), `${formatGold(grove.gold!)} gold`,
        gold(grove.gold!, unlockPl('grove:1'), groveBuilt ? 'Already built' : groveRoom ? undefined : NO_ROOM), { kind: 'grove' }, FOOTPRINT.breeder))}
      {shows('roost') && section('roost', 'Roost', card('roost', 'Dragon Roost', `${formatGold(roost.gold)} gold`,
        gold(roost.gold, unlockPl('roost:1'), s.roostPlacement ? 'Already built' : roostRoom ? undefined : NO_ROOM), { kind: 'roost' }, ROOST_FOOTPRINT))}
      {shows('farming') && section('farming', 'Farming', card('farm', 'Farm plot', plots >= MAX_FARMS ? 'maximum' : `${formatGold(farmBuildGold(plots + 1))} gold`,
        plots >= MAX_FARMS ? 'Maximum plots reached' : gold(farmBuildGold(plots + 1), unlockPl(`farm:${plots + 1}` as UnlockKey), farmRoom ? undefined : NO_ROOM), { kind: 'farm' }, FOOTPRINT.farm))}
      {shows('decorations') && section('decorations', 'Decorations', (Object.keys(DECORATIONS) as DecorationId[]).map(id => {
        const d = DECORATIONS[id]
        // Locked items stay visible, greyed (spec section 8): an item for one island says so anywhere else.
        const reason = d.island && d.island !== view ? `${ISLANDS[d.island].name} only` : gold(d.cost, d.minLevel, decoRoom[id] ? undefined : NO_ROOM)
        return card(`deco-${id}`, decorationName(id), `${formatGold(d.cost)} gold`, reason, { kind: 'decoration', decoration: id }, d.size, <SpriteStill sprite={gameArt.decoration[id]} height={48} />)
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
          <small style={{ display: 'block', color: 'var(--text-muted)' }}>A level 5 habitat for any element. You pick the spot, then press OK. One per player.</small>
        </li>
      ))}
    </>
  )
}
