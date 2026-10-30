import {
  DECORATIONS, ELEMENTS, FOOD_PACK, FOOTPRINT, HABITATS, FARM_UNLOCK_PL, farmBuildGold, MAX_FARMS, priceMicroUsd,
  type DecorationId, type Footprint, type IslandId, type PlayerState, type SkipTarget, type StoreItem,
} from '@wyrmhaven/game-core'
import { useState, type ReactNode } from 'react'
import type { Placing } from '../game/bridge'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { formatGold, formatMicroUsd, formatSkipPrice } from '../ui/Money'
import { ActionButton, Panel } from '../ui/Panel'
import { Timer } from '../ui/Timer'

export type ShopTab = 'build' | 'store'

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)
/** "flowerPatch" -> "Flower patch". */
const decorationName = (id: DecorationId) => cap(id.replace(/([A-Z])/g, ' $1').toLowerCase())
const DAWNSPIRE_ONLY = 'Dawnspire only'

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
  if (!s) return null
  return (
    <Panel title="Shop" onClose={onClose}>
      <div className="hud-tabs" role="tablist" aria-label="Shop sections">
        <button type="button" role="tab" className="hud-tab" aria-selected={tab === 'build'} onClick={() => setTab('build')}>Build</button>
        <button type="button" role="tab" className="hud-tab" aria-selected={tab === 'store'} onClick={() => setTab('store')}>Store</button>
      </div>
      <div role="tabpanel" aria-label={tab === 'build' ? 'Build' : 'Store'}>
        {tab === 'build' ? <BuildTab s={s} onPlace={onPlace} view={view} /> : <StoreTab s={s} nowMs={nowMs} onPlace={onPlace} />}
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
function BuildTab({ s, onPlace, view }: { s: PlayerState; onPlace: ShopPanelProps['onPlace']; view: IslandId }) {
  const card = (id: string, label: string, price: string, reason: string | undefined, what: Placing['what'], size: Footprint) => (
    <li key={id}>
      <ActionButton id={`shop-${id}`} disabled={Boolean(reason)} reason={reason} onClick={() => onPlace(what, size)}>
        {label} · {price}
      </ActionButton>
    </li>
  )
  const gold = (cost: number, minLevel: number, other?: string) =>
    s.level < minLevel ? `Level ${minLevel}` : other ?? (s.gold < cost ? 'Not enough gold' : undefined)

  const plots = s.farms.length
  return (
    <>
      {section('habitats', 'Habitats', <>
        {ELEMENTS.map(el => {
          const { buildGold, unlockPl } = HABITATS[el]
          return card(`habitat-${el}`, `${cap(el)} habitat`, `${formatGold(buildGold)} gold`,
            gold(buildGold, unlockPl), { kind: 'habitat', element: el }, FOOTPRINT.habitat)
        })}
      </>)}
      {section('farming', 'Farming', card('farm', 'Farm plot', plots >= MAX_FARMS ? 'maximum' : `${formatGold(farmBuildGold(plots + 1))} gold`,
        plots >= MAX_FARMS ? 'Maximum plots reached' : gold(farmBuildGold(plots + 1), FARM_UNLOCK_PL[plots]!), { kind: 'farm' }, FOOTPRINT.farm))}
      {section('decorations', 'Decorations', (Object.keys(DECORATIONS) as DecorationId[]).map(id => {
        const d = DECORATIONS[id]
        // Locked items stay visible, greyed (spec section 8): Dawnspire-only ones say so off the Dawnspire.
        const reason = d.island && d.island !== view ? DAWNSPIRE_ONLY : gold(d.cost, d.minLevel)
        return card(`deco-${id}`, decorationName(id), `${formatGold(d.cost)} gold`, reason, { kind: 'decoration', decoration: id }, d.size)
      }))}
    </>
  )
}

interface TimerRow { id: string; label: string; target: SkipTarget; index: number; readyAtMs: number }

/** Every running timer that can be skipped, in the order the player meets them. */
function runningTimers(s: PlayerState): TimerRow[] {
  const rows: TimerRow[] = []
  s.constructions.forEach((c, i) => rows.push({
    id: `construction-${i}`, label: c.kind === 'build' ? 'Building' : 'Upgrade', target: 'construction', index: i, readyAtMs: c.readyAtMs,
  }))
  s.nests.forEach((n, i) => { if (n.egg) rows.push({ id: `nest-${i}`, label: `Nest ${i + 1} egg`, target: 'nest', index: i, readyAtMs: n.egg.readyAtMs }) })
  s.hatchery.forEach((e, i) => { if (e) rows.push({ id: `hatch-${i}`, label: `Hatchery egg ${i + 1}`, target: 'hatchery', index: i, readyAtMs: e.readyAtMs }) })
  s.farms.forEach((f, i) => { if (f.crop !== null) rows.push({ id: `farm-${i}`, label: `Farm plot ${i + 1}`, target: 'farm', index: i, readyAtMs: f.readyAtMs }) })
  return rows
}

/** USD-priced items. Prices come from game-core; the DRIS charge is worked out by the server at the current rate. */
function StoreTab({ s, nowMs, onPlace }: { s: PlayerState; nowMs: number; onPlace: ShopPanelProps['onPlace'] }) {
  const { run, pending } = useAction()
  const buy = (item: StoreItem) => void run({ type: 'buy', item })
  const price = (item: StoreItem) => priceMicroUsd(item, s, nowMs)

  const foodPrice = price({ kind: 'foodPack' })
  const aeriePrice = price({ kind: 'goldenAerie', placement: { island: 'home', col: 0, row: 0, facing: 0 } })
  const timers = runningTimers(s).filter(t => price({ kind: 'skip', target: t.target, index: t.index }) !== null)
  const habitats = s.habitats.filter(h => price({ kind: 'habitatL5', habitatId: h.id }) !== null)
  const farms = s.farms.map((f, index) => ({ f, index })).filter(({ index }) => price({ kind: 'farmL5', index }) !== null)

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
      {section('level5', 'Level 5 upgrades', habitats.length + farms.length === 0
        ? <li><small>Level 4 habitats and farm plots can be upgraded to level 5 here, instantly.</small></li>
        : <>
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
      {section('aerie', 'Golden Aerie', (
        <li>
          <ActionButton id="buy-golden-aerie" disabled={aeriePrice === null} reason="Not available right now" onClick={() => onPlace({ kind: 'goldenAerie' }, FOOTPRINT.habitat)}>
            Golden Aerie{aeriePrice !== null ? ` · ${formatMicroUsd(aeriePrice)}` : ''}
          </ActionButton>
          <small style={{ display: 'block', color: 'var(--text-muted)' }}>A level 5 habitat for any element. You pick the spot, then confirm.</small>
        </li>
      ))}
    </>
  )
}
