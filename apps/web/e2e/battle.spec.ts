import { expect, test } from '@playwright/test'
import { openPanel, resetPlayer, signIn, seaTeam } from './helpers'

test('plays a real Trial node, resumes after a reload, and gets offers in the arena', async ({ page, request }) => {
  page.on('pageerror', e => console.log('PAGEERROR', e.message))
  await signIn(page)
  await resetPlayer(request, { level: 8, dragons: seaTeam(20), defenceTeam: ['d1', 'd2', 'd3'] })
  await page.reload()

  // Chapter 1 node 1 is three level-1 enemies; a level-20 team wins with Strike alone (the first button), Physical never being immune.
  await openPanel(page, 'Trials')
  await expect(page.getByRole('list', { name: 'Chapters' }).getByRole('button')).toHaveCount(10)
  await page.getByRole('list', { name: 'Nodes' }).getByRole('button', { name: /^node 1 ·/i }).click()
  const moves = page.getByRole('group', { name: /^move$/i }).getByRole('button')
  await expect(moves).toHaveCount(4)
  for (const box of [await moves.first().boundingBox(), await page.getByRole('group', { name: /^swap$/i }).getByRole('button').first().boundingBox()]) {
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }

  // One move in, a reload: the Trial is still active and the draft comes back on Resume.
  await moves.first().click()
  await expect(page.getByText(/turn 2 of 30/i)).toBeVisible()
  await page.reload()
  await openPanel(page, 'Trials')
  await expect(page.getByRole('status', { name: 'Trial in progress' })).toContainText('Terra Wilds')
  await page.getByRole('button', { name: 'Resume' }).click()
  await expect(page.getByText(/turn 2 of 30/i)).toBeVisible()

  const replacement = page.getByRole('group', { name: /^replacement$/i }).getByRole('button')
  for (let i = 0; i < 45; i++) {
    if (await page.getByText(/you win/i).isVisible()) break
    if (await replacement.first().isVisible()) await replacement.first().click()
    else await moves.first().click()
  }
  await expect(page.getByText(/you win/i)).toBeVisible()
  await page.getByRole('button', { name: /^submit$/i }).click()
  await expect(page.getByRole('status', { name: /battle result/i })).toContainText('Victory')
  await expect(page.getByRole('status', { name: /battle result/i })).toContainText('1,000 gold')
  await expect(page.getByRole('status', { name: /resources/i })).toContainText('2,000') // 1,000 gold first clear

  // Arena: with a saved defence team the server offers three opponents (bots on an empty server).
  await page.getByRole('button', { name: /close/i }).click()
  await openPanel(page, 'Arena')
  await page.getByRole('button', { name: /find opponents/i }).click()
  await expect(page.getByRole('list', { name: /opponents/i }).getByRole('listitem')).toHaveCount(3)
})
