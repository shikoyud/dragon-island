import manifestV1 from '../../public/art/v1/manifest.json'
import { artSetFromManifest, type Manifest } from './fromManifest'
import type { ArtSet } from './types'

/** The only place art is chosen. To swap in real art, add a folder and point this at its manifest. */
export const ACTIVE_ART: ArtSet = artSetFromManifest('v1', manifestV1 as Manifest)
