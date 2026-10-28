import { LAUNCH_CATALOG } from '@wyrmhaven/game-core'
import { artSetFromManifest, type Manifest } from './fromManifest'
import type { GameArtSet } from './types'

/** The art folder in use. Bump when a new PixelLab set lands under public/art/<version>/. */
export const ART_VERSION = 'v0'

const EMPTY: Manifest = { assets: {} }

/** Loads the active manifest; a missing or broken file yields an all-fallback set so the game still runs. */
export async function loadActiveArt(fetchImpl: typeof fetch = fetch): Promise<GameArtSet> {
  try {
    const res = await fetchImpl(`/art/${ART_VERSION}/manifest.json`)
    const manifest = res.ok ? ((await res.json()) as Manifest) : EMPTY
    return artSetFromManifest(ART_VERSION, manifest, LAUNCH_CATALOG)
  } catch {
    return artSetFromManifest(ART_VERSION, EMPTY, LAUNCH_CATALOG)
  }
}

export const FALLBACK_ART: GameArtSet = artSetFromManifest(ART_VERSION, EMPTY, LAUNCH_CATALOG)
