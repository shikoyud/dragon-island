import { getDeps } from '@/server/getDeps'
import * as handlers from '@/server/handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ task: string }> }): Promise<Response> {
  return handlers.confirmTask(await getDeps(), req, await ctx.params)
}
