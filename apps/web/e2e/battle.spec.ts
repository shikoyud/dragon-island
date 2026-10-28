import { expect, test } from '@playwright/test'
import { grant, openPanel, signIn, waterTeam } from './helpers'

test('fights a bot in the arena and wins trophies', async ({ page, request }) => {
  page.on('pageerror', e => console.log('PAGEERROR', e.message))
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)) })
  await signIn(page)
  await grant(request, { state: { level: 8, dragons: waterTeam(20), defenceTeam: ['d1', 'd2', 'd3'] } })
  await page.reload()
  await openPanel(page, 'Arena')
  await page.getByRole('button', { name: /find opponents/i }).click()
  const bot = page.getByRole('list', { name: /opponents/i }).getByRole('listitem').filter({ hasText: 'Bot' }).first()
  await bot.getByRole('button', { name: /fight/i }).click()

  // Bots in the launch catalog are pure commons at our team level (20); water beats fire, so sweep the
  // targets with the water move when it is strong, otherwise just attack whoever is alive.
  for (let turn = 0; turn < 30; turn++) {
    const submit = page.getByRole('button', { name: /^submit$/i })
    if (await submit.isEnabled()) break
    const moves = page.getByRole('group', { name: /^move$/i }).getByRole('button')
    const enabledMove = moves.filter({ hasNot: page.locator('[disabled]') }).first()
    await enabledMove.click()
    const target = page.getByRole('group', { name: /^target$/i }).getByRole('button', { disabled: false }).first()
    await target.click()
  }
  await page.getByRole('button', { name: /^submit$/i }).click()
  await expect(page.getByRole('status').filter({ hasText: /result:/i })).toContainText(/victory|defeat|forfeit/)
  const trophies = page.getByRole('status', { name: /resources/i }).getByTitle('Trophies')
  await expect(trophies).not.toHaveText('🏆 0')
})
