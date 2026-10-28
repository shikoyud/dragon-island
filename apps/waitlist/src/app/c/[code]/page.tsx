import type { Metadata } from 'next'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { getCardData } from '@/server/entrants'
import { getDeps } from '@/server/getDeps'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ code: string }> }

const loadCard = cache(async (code: string) => getCardData(await getDeps(), code))

const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '')
const cardUrl = (code: string) => `${site()}/api/card/${encodeURIComponent(code)}.png`

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params
  const data = await loadCard(code)
  if (!data) return {}
  const title = `@${data.handle} is #${data.position} on the Wyrmhaven waitlist`
  return {
    title,
    openGraph: { title, images: [cardUrl(code)] },
    twitter: { card: 'summary_large_image', title, images: [cardUrl(code)] },
  }
}

export default async function CardPage({ params }: Props) {
  const { code } = await params
  const data = await loadCard(code)
  if (!data) notFound()
  return (
    <main>
      <img
        src={cardUrl(code)}
        alt={`Wyrmhaven card for @${data.handle}, #${data.position}`}
        width={1200}
        height={675}
        style={{ maxWidth: '100%', height: 'auto' }}
      />
      <p>
        <a href={`/?ref=${encodeURIComponent(code)}#join`}>Join the waitlist</a>
      </p>
    </main>
  )
}
