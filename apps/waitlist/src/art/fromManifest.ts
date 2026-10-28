import { ELEMENTS, type Element } from '../domain/elements'
import type { ArtSet, Sprite } from './types'

export interface ManifestAsset {
  file: string
  w: number
  h: number
  frames: number
  fps: number
}
export interface Manifest {
  assets: Record<string, ManifestAsset>
}

const EMPTY: Sprite = { src: '', w: 16, h: 16, frames: 1, fps: 1 }

/** Build an ArtSet from a version folder's manifest. Missing keys become empty (fallback) sprites. */
export function artSetFromManifest(version: string, manifest: Manifest): ArtSet {
  const get = (key: string): Sprite => {
    const a = manifest.assets[key]
    return a ? { src: `/art/${version}/${a.file}`, w: a.w, h: a.h, frames: a.frames, fps: a.fps } : { ...EMPTY }
  }
  const perElement = (prefix: string) =>
    Object.fromEntries(ELEMENTS.map((e) => [e, get(`${prefix}.${e}`)])) as Record<Element, Sprite>

  const layerKeys = Object.keys(manifest.assets)
    .map((k) => /^hero\.layer\.(\d+)$/.exec(k))
    .filter((m): m is RegExpExecArray => m !== null)
    .sort((a, b) => Number(a[1]) - Number(b[1]))

  return {
    version,
    hero: { base: get('hero.base'), layers: layerKeys.map((m) => get(m[0])) },
    egg: perElement('egg'),
    hatchling: perElement('hatchling'),
    elementIcon: perElement('icon'),
    ui: { panel: get('ui.panel'), button: get('ui.button') },
  }
}
