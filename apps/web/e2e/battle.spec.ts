import { BATTLE_SPOT, battleStage } from '../src/game/layout'
import { expect, test, type Page } from '@playwright/test'
import { openPanel, resetPlayer, signIn, seaTeam } from './helpers'

const moves = (page: Page) => page.getByRole('group', { name: /^move$/i }).getByRole('button')
/** Who can be sent in: the list also shows the fallen, disabled. */
const replacement = (page: Page) => page.getByRole('group', { name: /^replacement$/i }).getByRole('button').and(page.locator(':enabled'))
const result = (page: Page) => page.getByRole('status', { name: /battle result/i })
const turn = (page: Page, n: number) => page.getByText(`Turn ${n} / 30`)

/** Plays by the first move (Strike, which is never immune) until the result, sending in `pick` after a KO. Says whether it saw a KO. */
async function playOut(page: Page, pick: 'first' | 'last' = 'first'): Promise<boolean> {
  let sawKo = false
  for (let i = 0; i < 60; i++) {
    const next = result(page).or(replacement(page).first()).or(moves(page).first().and(page.locator(':enabled')))
    await expect(next).toBeVisible({ timeout: 10_000 })
    if (await result(page).isVisible()) return sawKo
    if (await replacement(page).first().isVisible()) {
      sawKo = true
      await replacement(page)[pick]().click()
    } else {
      await moves(page).first().click().catch(() => { /* it was taken away by a KO appearing: go round again */ })
    }
  }
  throw new Error('the battle did not end')
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('a real Trial by clicks: attack, swap, a KO and its replacement, a win with stars, back to the nodes', async ({ page, request }) => {
    page.on('pageerror', e => console.log('PAGEERROR', e.message))
    await signIn(page)
    // Two weak dragons at the 25 % line and one strong: Terra Wilds' level-1 enemies will KO the weak ones, and the strong one wins it.
    const [, , strong] = seaTeam(20)
    const weak = (id: string) => ({ id, speciesId: 'sea', level: 1, feeds: 0, habitatId: 'h2', fatigue: { hp: 400, atMs: Date.now() } })
    await resetPlayer(request, { level: 8, dragons: [weak('d1'), weak('d2'), strong], defenceTeam: ['d1', 'd2', 'd3'] })
    await page.reload()

    await openPanel(page, 'Trials')
    await expect(page.getByRole('list', { name: 'Chapters' }).getByRole('button')).toHaveCount(10)
    await page.getByRole('list', { name: 'Chapters' }).getByRole('button', { name: /^terra wilds/i }).click()
    await page.getByRole('list', { name: 'Nodes' }).getByRole('button', { name: /^node 1 ·/i }).click()
    await page.getByRole('button', { name: 'Fight', exact: true }).click()

    await expect(moves(page)).toHaveCount(4)
    await expect(turn(page, 1)).toBeVisible()
    await expect(page.getByText('3★: 8 turns, no KOs')).toBeVisible()
    for (const b of await moves(page).all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect((await page.getByRole('button', { name: 'Swap Dragon' }).boundingBox())!.height).toBeGreaterThanOrEqual(44)
    // The whole screen fits with no scroll: the grid and Swap inside the viewport.
    expect((await page.getByRole('button', { name: 'Swap Dragon' }).boundingBox())!.y + 44).toBeLessThanOrEqual(844)
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(844)
    // Landscape layout held upright (R98): both plates on screen side by side, both benches down the edges.
    const yours = (await page.getByRole('group', { name: 'Yours' }).boundingBox())!
    const enemy = (await page.getByRole('group', { name: 'Enemy', exact: true }).boundingBox())!
    expect(yours.x + yours.width).toBeLessThanOrEqual(enemy.x)
    expect(enemy.x + enemy.width).toBeLessThanOrEqual(390)
    await expect(page.getByRole('group', { name: 'Your bench' }).getByRole('button')).toHaveCount(2)
    await expect(page.getByRole('group', { name: 'Enemy bench' }).getByRole('img')).toHaveCount(2)

    // An attack: inputs off while it plays, then the turn has moved on by both sides. A weak dragon may fall to the reply.
    await moves(page).first().click()
    await expect(moves(page).first().or(replacement(page).first())).toBeVisible()
    await expect(moves(page).first().and(page.locator(':enabled')).or(replacement(page).first())).toBeVisible({ timeout: 10_000 })
    await expect(turn(page, 3)).toBeVisible()
    let sawKo = await replacement(page).first().isVisible()
    if (sawKo) await replacement(page).first().click()

    // A reload resumes the draft with nothing replayed.
    await page.reload()
    await openPanel(page, 'Trials')
    await expect(page.getByRole('status', { name: 'Trial in progress' })).toContainText('Terra Wilds')
    await page.getByRole('button', { name: 'Resume' }).click()
    await expect(moves(page)).toHaveCount(4)
    await expect(page.getByText(/Turn [3-9] \/ 30/)).toBeVisible()

    // A swap: the bench opens, Back returns, picking uses the turn.
    const swap = page.getByRole('button', { name: 'Swap Dragon' })
    await expect(swap).toBeEnabled({ timeout: 10_000 })
    await swap.click()
    const bench = page.getByRole('group', { name: /^swap$/i })
    await expect(bench).toBeVisible()
    await bench.getByRole('button', { name: 'Back' }).click()
    await expect(moves(page)).toHaveCount(4)
    await swap.click()
    await page.waitForTimeout(300) // past the double-tap guard
    await bench.getByRole('button', { name: /L\d/ }).and(page.locator(':enabled')).first().click()
    await expect(bench).toBeHidden()

    // Fight on: the weak fall, the strong one comes in and wins.
    sawKo = (await playOut(page, 'last')) || sawKo
    expect(sawKo).toBe(true)
    await expect(result(page)).toContainText('Victory')
    await expect(result(page)).toContainText('1,000 gold')
    // The marks are the ui.star art when the manifest has it, else the ★ glyphs: either way there is one mark per star earned.
    await expect(result(page).getByLabel(/\d stars/).locator('img, span')).not.toHaveCount(0)

    // Back on this chapter's nodes, not the list of chapters; the Hud is back, and paid.
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('list', { name: 'Nodes' })).toBeVisible()
    await expect(page.getByRole('status', { name: /resources/i })).toContainText('2,000') // 1,000 gold first clear
  })

  test('Abandon asks with its cost, from the battle and from the banner, and a Trial cannot be left for free', async ({ page, request }) => {
    await signIn(page)
    await resetPlayer(request, { level: 8, dragons: seaTeam(20), defenceTeam: ['d1', 'd2', 'd3'] })
    await page.reload()
    await openPanel(page, 'Trials')
    await page.getByRole('list', { name: 'Chapters' }).getByRole('button', { name: /^terra wilds/i }).click()
    await page.getByRole('list', { name: 'Nodes' }).getByRole('button', { name: /^node 1 ·/i }).click()
    await page.getByRole('button', { name: 'Fight', exact: true }).click()
    await expect(moves(page)).toHaveCount(4)

    await page.getByRole('button', { name: 'Exit battle' }).click()
    const ask = page.getByRole('alertdialog', { name: 'Abandon?' })
    await expect(ask).toContainText('The team falls to 1 HP')
    await ask.getByRole('button', { name: 'Keep fighting' }).click()
    await expect(ask).toBeHidden()
    await expect(moves(page)).toHaveCount(4)

    // Left by a reload: the banner's Abandon asks too.
    await page.reload()
    await openPanel(page, 'Trials')
    await page.getByRole('button', { name: 'Abandon' }).click()
    await expect(ask).toContainText('The team falls to 1 HP')
    await page.keyboard.press('Escape')
    await expect(ask).toBeHidden()
    await expect(page.getByRole('status', { name: 'Trial in progress' })).toBeVisible()

    await page.getByRole('button', { name: 'Resume' }).click()
    await page.getByRole('button', { name: 'Exit battle' }).click()
    await ask.getByRole('button', { name: 'Abandon' }).click()
    await expect(page.getByRole('list', { name: 'Nodes' })).toBeVisible()
    await expect(page.getByRole('status', { name: 'Trial in progress' })).toBeHidden()
  })
})

test.describe('on a desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('PvP: the landscape screen with the moves bar along the bottom; a real fight to its result, and a forfeit that states its cost', async ({ page, request }) => {
    page.on('pageerror', e => console.log('PAGEERROR', e.message))
    await signIn(page)
    await resetPlayer(request, { level: 8, trophies: 100, dragons: seaTeam(20), defenceTeam: ['d1', 'd2', 'd3'] })
    await page.reload()

    const arena = async () => {
      await openPanel(page, 'Arena')
      await page.getByRole('button', { name: /find opponents|refresh opponents/i }).click()
      await expect(page.getByRole('list', { name: /opponents/i }).getByRole('listitem')).toHaveCount(3)
      await page.getByRole('list', { name: /opponents/i }).getByRole('button', { name: 'Fight' }).first().click()
      await expect(moves(page)).toHaveCount(4)
    }

    await arena()
    // The moves bar spans the bottom of the screen (R98), the four moves in one row, below both dragons' feet.
    const bar = (await page.locator('.battle__controls').boundingBox())!
    expect(bar.x).toBe(0)
    expect(Math.round(bar.width)).toBe(1440)
    expect(Math.round(bar.y + bar.height)).toBe(900)
    const ys = await Promise.all((await moves(page).all()).map(async b => Math.round((await b.boundingBox())!.y)))
    expect(new Set(ys).size).toBe(1)
    const stage = battleStage(1440, 900)
    expect(stage.y + BATTLE_SPOT.attacker.y * stage.zoom).toBeLessThanOrEqual(bar.y)
    await expect(page.getByText(/3★/)).toBeHidden()

    await playOut(page)
    await expect(result(page)).toContainText(/Victory|Defeat/)
    await expect(result(page)).toContainText(/Trophies \d+/)
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name: 'Shop', exact: true })).toBeVisible()

    await arena()
    await page.getByRole('button', { name: 'Exit battle' }).click()
    await expect(page.getByRole('alertdialog', { name: 'Abandon?' })).toContainText(/You lose \d+ troph/)
    await page.getByRole('alertdialog').getByRole('button', { name: 'Abandon' }).click()
    await expect(result(page)).toContainText('Defeat')
    await expect(result(page)).toContainText(/Trophies \d+/)
  })
})
