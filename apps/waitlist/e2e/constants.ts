import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const E2E_PORT = 3100
export const E2E_PGLITE_DIR = join(tmpdir(), 'dragon-island-waitlist-e2e-pglite')
export const E2E_CARD_CODE = 'E2ECARD1'
