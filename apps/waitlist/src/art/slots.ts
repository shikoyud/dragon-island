import manifestV0 from '../../public/art/v0/manifest.json'
import { artSetFromManifest, type Manifest } from './fromManifest'
import type { ArtSet } from './types'

/** The only place art is chosen. To swap in real art, add a folder and point this at its manifest. */
export const ACTIVE_ART: ArtSet = artSetFromManifest('v0', manifestV0 as Manifest)
