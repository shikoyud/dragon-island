import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { bodyFont, displayFont } from '../styles/fonts'
import '../styles/tokens.css'
import './globals.css'

const site = process.env.NEXT_PUBLIC_SITE_URL

export const metadata: Metadata = {
  ...(site ? { metadataBase: new URL(site) } : {}),
  title: 'Wyrmhaven — Join the waitlist',
  description:
    'Wyrmhaven is an original pixel-art dragon game: breed dragons in nests, build an island of element habitats and battle 3v3 in 14-day seasons. Join the waitlist.',
}

export const viewport: Viewport = { themeColor: '#0b0f24', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  )
}
