// Self-hosted pixel fonts (UI rework ruling P1), both SIL OFL 1.1: they ship in the bundle, so text never falls back to
// a browser default while a remote font loads or when it is blocked.
import '@fontsource/silkscreen/400.css'
import '@fontsource/silkscreen/700.css'
import '@fontsource/pixelify-sans/400.css'
import '@fontsource/pixelify-sans/600.css'

/** Starts both families downloading at once: canvas text (Phaser) draws with whatever is loaded, and @font-face is lazy. */
export function preloadPixelFonts(fonts: FontFaceSet | undefined = typeof document === 'undefined' ? undefined : document.fonts): Promise<unknown> {
  if (!fonts) return Promise.resolve()
  return Promise.all(['8px "Silkscreen"', '700 8px "Silkscreen"', '12px "Pixelify Sans"', '600 12px "Pixelify Sans"'].map(f => fonts.load(f))).catch(() => undefined)
}
