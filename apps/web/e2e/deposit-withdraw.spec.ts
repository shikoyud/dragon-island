import { expect, test } from '@playwright/test'
import { grant, openPanel, signIn } from './helpers'

test('requests a withdrawal voucher from the game balance', async ({ page, request }) => {
  await signIn(page)
  await grant(request, { tokenWei: (100n * 10n ** 18n).toString(), earningUnlocked: true })
  await page.reload()
  await openPanel(page, 'Wallet')
  await expect(page.getByText(/game balance:/i)).toContainText('100 WYRM')
  await page.getByLabel(/withdraw amount/i).fill('1')
  await page.getByRole('button', { name: /request withdrawal/i }).click()
  await expect(page.getByText(/pending voucher: 1 WYRM/i)).toBeVisible()
  await expect(page.getByText(/game balance:/i)).toContainText('99 WYRM')
  await page.reload()
  await openPanel(page, 'Wallet')
  await expect(page.getByText(/pending voucher: 1 WYRM/i)).toBeVisible()
})

test('deposits and claims on-chain', async () => {
  test.skip(!process.env['E2E_RPC_URL'], 'Needs a local anvil with the Phase 3 contracts (set E2E_RPC_URL, E2E_VAULT, E2E_TOKEN)')
  // Implemented once a testnet or local deployment is available: approve → deposit → indexer credits; claim voucher on-chain.
})
