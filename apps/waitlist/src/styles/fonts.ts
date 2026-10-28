import { Inter, Silkscreen } from 'next/font/google'

export const displayFont = Silkscreen({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-silkscreen', display: 'swap' })
export const bodyFont = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
