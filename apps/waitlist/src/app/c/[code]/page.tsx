import type { Metadata } from 'next'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { cardPageMetadata } from '@/card/cardUrl'
import { CardView } from '@/components/CardView'
import { getCardData } from '@/server/entrants'
import { getDeps } from '@/server/getDeps'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ code: string }> }

const loadCard = cache(async (code: string) => getCardData(await getDeps(), code))

const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '')

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params
  const data = await loadCard(code)
  if (!data) return {}
  return cardPageMetadata(data, code, site())
}

export default async function CardPage({ params }: Props) {
  const { code } = await params
  const data = await loadCard(code)
  if (!data) notFound()
  return <CardView code={code} handle={data.handle} position={data.position} />
}
