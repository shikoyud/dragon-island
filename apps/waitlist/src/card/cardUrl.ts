import type { Metadata } from 'next'
import { ACTIVE_ART } from '../art/slots'

/**
 * Site-relative URL of a share card PNG. `?v=` carries the art version, so swapping the art set
 * gives every card a new URL and X / browsers do not keep serving the old image.
 */
export function cardImagePath(code: string): string {
  return `/api/card/${encodeURIComponent(code)}.png?v=${encodeURIComponent(ACTIVE_ART.version)}`
}

/** Social preview tags for `/c/<code>`. `site` is NEXT_PUBLIC_SITE_URL without a trailing slash. */
export function cardPageMetadata(data: { handle: string; position: number }, code: string, site: string): Metadata {
  const title = `@${data.handle} is #${data.position} on the Wyrmhaven waitlist`
  const image = `${site}${cardImagePath(code)}`
  return {
    title,
    openGraph: { title, images: [image] },
    twitter: { card: 'summary_large_image', title, images: [image] },
  }
}
