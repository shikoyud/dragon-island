import { expect, test } from '@playwright/test'
import { dismissLevelUp, openPanel, resetPlayer, selectTarget, setServerClock, signIn } from './helpers'

test('lists the scripted first hybrids, breeds, moves the egg to the Hatchery and hatches a third dragon', async ({ page, request }) => {
  await signIn(page)
  // PL 2, Terra and Flame at level 4 (breeding needs both, §5.4). Terra x Flame holds hybrids, so the first breed is the
  // scripted first hybrid (§3.5): 1 minute to breed and 1 minute to hatch, real time under every preset (R25). The
  // server clock is moved forward instead of waiting.
  await resetPlayer(request, { level: 2, food: 1_000, dragons: [
    { id: 'd1', speciesId: 'terra', level: 4, feeds: 0, habitatId: 'h1' },
    { id: 'd2', speciesId: 'flame', level: 4, feeds: 0, habitatId: 'h2' },
  ] })
  try {
    await page.reload()
    await openPanel(page, 'Breed')
    const panel = page.getByRole('region', { name: 'Breed' })
    await panel.locator('#parent-a-d1').click()
    await panel.locator('#parent-b-d2').click()
    const outcomes = panel.getByRole('list', { name: /breeding outcomes/i }).getByRole('listitem')
    await expect(outcomes).toHaveText(['Terra-Flame · Rare · 50.00% · 1m', 'Flame-Terra · Rare · 50.00% · 1m'])
    await panel.getByRole('button', { name: /^breed$/i }).click()
    await expect(panel.getByTestId('breeder-0')).toContainText(/Egg · /)
    await expect(panel.getByTestId('breeder-0')).not.toContainText(/terra|flame/i)

    await setServerClock(request, 61_000)
    await page.reload()
    await dismissLevelUp(page)
    // A ready egg: the breeding building's row collects it into the Hatchery (UI rework Phase 4).
    const row = await selectTarget(page, { kind: 'breeder', index: 0 })
    await row.getByRole('button', { name: 'Collect Egg' }).click()
    await expect(row.getByRole('button', { name: 'Breed', exact: true })).toBeVisible()

    await setServerClock(request, 130_000)
    await page.reload()
    await openPanel(page, 'Hatchery')
    const hatch = page.getByRole('button', { name: /^hatch$/i })
    await expect(hatch).toBeEnabled()
    await hatch.click()
    // The hatched dragon moved into a habitat, so the slot is free again; the toast names the species.
    await expect(page.getByRole('region', { name: 'Hatchery · 0/1' })).toBeVisible()
    await expect(page.getByText('Empty')).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: /^Hatched / })).toBeVisible()
    // The New dragon screen (UI rework Phase 5) shows it after any level-up; it already has a home, so Done closes it.
    await dismissLevelUp(page)
    const fresh = page.getByRole('dialog', { name: 'New dragon' })
    await expect(fresh).toBeVisible()
    await fresh.getByRole('button', { name: 'Done' }).click()

    // The new dragon is now part of the state: the Arena team picker lists all three, named by species and level.
    await openPanel(page, 'Arena')
    await expect(page.getByRole('group', { name: /attack team/i }).getByRole('button', { name: / L\d+$/ })).toHaveCount(3)
  } finally {
    await setServerClock(request, 0)
  }
})
