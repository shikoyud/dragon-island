import { getDeps } from '@/server/getDeps'
import * as handlers from '@/server/handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request): Promise<Response> {
  return handlers.walletNonce(await getDeps(), req)
}
