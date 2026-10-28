import { cardResponse } from '@/card/cardRoute'
import { getDeps } from '@/server/getDeps'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await ctx.params
  return cardResponse(await getDeps(), code)
}
