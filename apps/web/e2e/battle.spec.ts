import { expect, test } from '@playwright/test'
import { openPanel, resetPlayer, signIn, seaTeam } from './helpers'

test('clears campaign stage 1 and gets offers in the arena', async ({ page, request }) => {
  page.on('pageerror', e => console.log('PAGEERROR', e.message))
  await signIn(page)
  await resetPlayer(request, { level: 8, dragons: seaTeam(20), defenceTeam: ['d1', 'd2', 'd3'] })
  await page.reload()

  // Campaign: stage 1 is three level-3 commons; a level-20 team wins whatever moves it picks.
  await openPanel(page, 'Campaign')
  await page.getByRole('list', { name: /stages/i }).getByRole('button', { name: /^stage 1 ·/i }).click()
  for (let turn = 0; turn < 30; turn++) {
    if (await page.getByText(/you win/i).isVisible()) break
    await page.getByRole('group', { name: /^move$/i }).getByRole('button', { disabled: false }).first().click()
    await page.getByRole('group', { name: /^target$/i }).getByRole('button', { disabled: false }).first().click()
  }
  await expect(page.getByText(/you win/i)).toBeVisible()
  await page.getByRole('button', { name: /^submit$/i }).click()
  await expect(page.getByRole('status').filter({ hasText: /result:/i })).toContainText('victory')
  await expect(page.getByRole('status', { name: /resources/i })).toContainText('1,100') // 100 gold first clear

  // Arena: with a saved defence team the server offers three opponents (bots on an empty server).
  await page.getByRole('button', { name: /close/i }).click()
  await openPanel(page, 'Arena')
  await page.getByRole('button', { name: /find opponents/i }).click()
  await expect(page.getByRole('list', { name: /opponents/i }).getByRole('listitem')).toHaveCount(3)
})
