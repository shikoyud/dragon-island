import { expect, test } from '@playwright/test'
import { openPanel, resetPlayer, signIn } from './helpers'

test('breeds, collects the egg, hatches a third dragon', async ({ page, request }) => {
  await signIn(page)
  // Both starters at level 4 (breeding needs ≥ 4); the tutorial egg and hatch take 15 s each.
  await resetPlayer(request, { food: 1_000, dragons: [
    { id: 'd1', speciesId: 'fire', level: 4, habitatId: 'h1' },
    { id: 'd2', speciesId: 'water', level: 4, habitatId: 'h2' },
  ] })
  await page.reload()
  await openPanel(page, 'Breed')
  const panel = page.getByRole('region', { name: 'Breed' })
  await panel.getByLabel(/first parent/i).selectOption('d1')
  await panel.getByLabel(/second parent/i).selectOption('d2')
  await expect(panel.getByRole('table', { name: /odds/i })).toContainText('50.00%')
  await panel.getByRole('button', { name: /^breed$/i }).click()

  await openPanel(page, 'Nests')
  await expect(page.getByText(/egg ·/i).first()).toBeVisible()
  const collect = page.getByRole('button', { name: /collect egg/i })
  await expect(collect).toBeEnabled({ timeout: 25_000 })
  await collect.click()
  const hatch = page.getByRole('button', { name: /^hatch$/i })
  await expect(hatch).toBeEnabled({ timeout: 25_000 })
  await hatch.click()
  await expect(page.getByText(/no eggs hatching/i)).toBeVisible()

  // The new dragon (d3) is now part of the state: it appears in the Arena team picker.
  await openPanel(page, 'Arena')
  await expect(page.getByRole('button', { name: /^d3 ·/ })).toBeVisible()
})
