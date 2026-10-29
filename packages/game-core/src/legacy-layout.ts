import { FOOTPRINT, HOME_MAX_STEP, homeSize, overlaps } from './island'
import type { Egg, Facing, FarmPlot, Habitat, Nest, Placement, PlayerState } from './state'

interface Box { col: number; row: number; size: number }

const at = (col: number, row: number): Placement => ({ island: 'home', col, row, facing: 0 as Facing })

/** Spec section 2 starting positions. */
const START = {
  habitats: { h1: at(0, 0), h2: at(5, 0) } as Record<string, Placement>,
  farms: [at(10, 0), at(10, 2)],
  hatchery: at(0, 8),
  nest: at(4, 8),
}

/**
 * Adds island state and placements to a state saved before base building. Starting buildings take the spec layout;
 * extra habitats, plots and nests take the first free spot scanning row-major; the home step rises (free) until
 * everything fits. Current states come back unchanged.
 *
 * Defensive fallback (not expected for realistic states): if something still does not fit at HOME_MAX_STEP, it is
 * placed at the first spot that fits the bounds, overlapping if it must, rather than failing the load.
 * Generated obstacles are not added for the raised steps; the new strips start clear.
 */
export function layoutLegacyState(raw: Record<string, unknown>): PlayerState {
  if ('islands' in raw) return raw as unknown as PlayerState
  const habitats = (raw['habitats'] as Record<string, unknown>[]) ?? []
  const farms = (raw['farms'] as Record<string, unknown>[]) ?? []
  const rawNests = (raw['nests'] as (Egg | null)[]) ?? []
  const hoardLevel = typeof raw['hoardLevel'] === 'number' ? raw['hoardLevel'] : 0

  for (let step = 0; step <= HOME_MAX_STEP; step++) {
    const laid = tryLayout(step, habitats, farms, rawNests, hoardLevel, false)
    if (laid) return build(raw, step, laid)
  }
  return build(raw, HOME_MAX_STEP, tryLayout(HOME_MAX_STEP, habitats, farms, rawNests, hoardLevel, true)!)
}

interface Laid { habitats: Placement[]; farms: Placement[]; nests: Placement[]; hatchery: Placement; hoard: Placement | null }

function tryLayout(step: number, habitats: Record<string, unknown>[], farms: unknown[], nests: unknown[], hoardLevel: number, force: boolean): Laid | null {
  const { w, h } = homeSize(step)
  const boxes: Box[] = []
  const inBounds = (col: number, row: number, size: number) => col >= 0 && row >= 0 && col + size <= w && row + size <= h
  const free = (col: number, row: number, size: number) => inBounds(col, row, size) && !boxes.some(b => overlaps({ col, row, size }, b))
  const place = (preferred: Placement | undefined, size: number): Placement | null => {
    if (preferred && free(preferred.col, preferred.row, size)) { boxes.push({ col: preferred.col, row: preferred.row, size }); return preferred }
    for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
      if (free(col, row, size)) { boxes.push({ col, row, size }); return at(col, row) }
    }
    if (force) { boxes.push({ col: 0, row: 0, size }); return at(0, 0) } // overlap fallback, see doc comment
    return null
  }
  const hatchery = place(START.hatchery, FOOTPRINT.hatchery)
  const hs: Placement[] = []
  const fs: Placement[] = []
  const ns: Placement[] = []
  if (!hatchery) return null
  // Starting buildings first so extras never steal their spots.
  const habPlaced = habitats.map(x => START.habitats[String(x['id'])] ? place(START.habitats[String(x['id'])], FOOTPRINT.habitat) : undefined)
  const farmPlaced = farms.map((_, i) => i < START.farms.length ? place(START.farms[i], FOOTPRINT.farm) : undefined)
  const nestPlaced = nests.map((_, i) => i === 0 ? place(START.nest, FOOTPRINT.nest) : undefined)
  for (const [list, out, size, src] of [
    [habPlaced, hs, FOOTPRINT.habitat, habitats], [farmPlaced, fs, FOOTPRINT.farm, farms], [nestPlaced, ns, FOOTPRINT.nest, nests],
  ] as const) {
    for (let i = 0; i < src.length; i++) {
      const p = list[i] ?? place(undefined, size)
      if (!p) return null
      out.push(p)
    }
  }
  let hoard: Placement | null = null
  if (hoardLevel > 0) {
    hoard = place(undefined, FOOTPRINT.hoard)
    if (!hoard) return null
  }
  return { habitats: hs, farms: fs, nests: ns, hatchery, hoard }
}

function build(raw: Record<string, unknown>, step: number, laid: Laid): PlayerState {
  const habitats = (raw['habitats'] as Record<string, unknown>[]).map((x, i) => ({ ...x, placement: laid.habitats[i]! }) as unknown as Habitat)
  const farms = (raw['farms'] as Record<string, unknown>[]).map((x, i) => ({ ...x, level: typeof x['level'] === 'number' ? x['level'] : 1, placement: laid.farms[i]! }) as unknown as FarmPlot)
  const nests: Nest[] = ((raw['nests'] as unknown[]) ?? []).map((n, i) => {
    const asNest = n as { egg?: Egg | null; level?: number; placement?: Placement } | null
    const isNest = asNest !== null && typeof asNest === 'object' && 'egg' in asNest
    return { egg: isNest ? asNest.egg ?? null : (n as Egg | null), level: isNest && typeof asNest.level === 'number' ? asNest.level : 1, placement: laid.nests[i]! }
  })
  const tutorial = { ...(raw['tutorial'] as object), buildsStarted: 2 }
  return {
    ...raw, habitats, farms, nests, tutorial,
    hatcheryLevel: typeof raw['hatcheryLevel'] === 'number' ? raw['hatcheryLevel'] : 1,
    hatcheryPlacement: laid.hatchery,
    hoardPlacement: laid.hoard,
    decorations: [],
    constructions: [],
    islands: { homeStep: step, unlocked: ['home'], obstacles: [] },
  } as unknown as PlayerState
}
