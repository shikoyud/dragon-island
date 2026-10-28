import { describe, expect, it } from 'vitest'
import { ELEMENTS, ELEMENT_COLORS, pickElement } from '../src/domain/elements'
import { walletMessage } from '../src/domain/walletMessage'
import { CONFIRM_DELAY_MS, TASKS, canConfirm, taskIntentUrl } from '../src/domain/tasks'
import { newRefCode } from '../src/domain/refCode'

describe('elements', () => {
  it('has the nine elements in order', () => {
    expect(ELEMENTS).toEqual(['fire', 'water', 'earth', 'nature', 'electric', 'ice', 'metal', 'dark', 'light'])
  })
  it('picks deterministically from sha256 of the X user id', () => {
    expect(pickElement('12345')).toBe('light')
    expect(pickElement('44196397')).toBe('metal')
    expect(pickElement('2')).toBe('ice')
  })
  it('has a colour triple for every element', () => {
    for (const e of ELEMENTS) {
      for (const k of ['base', 'light', 'dark'] as const) {
        expect(ELEMENT_COLORS[e][k]).toMatch(/^#[0-9a-f]{6}$/i)
      }
    }
  })
})

describe('walletMessage', () => {
  it('builds the exact text with a checksummed address', () => {
    const lower = '0x52908400098527886e0f7030069857d2e4169ee7'
    expect(walletMessage('wyrm', lower as `0x${string}`, 'n1')).toBe(
      'Wyrmhaven waitlist\nX: @wyrm\nAddress: 0x52908400098527886E0F7030069857D2E4169EE7\nNonce: n1',
    )
  })
})

describe('tasks', () => {
  it('lists the four tasks', () => {
    expect(TASKS).toEqual(['follow', 'like', 'repost', 'comment'])
  })
  it('enforces the confirm delay', () => {
    const now = new Date('2026-10-29T12:00:00Z')
    expect(canConfirm(null, now)).toBe('TASK_NOT_OPENED')
    expect(canConfirm(new Date(now.getTime() - (CONFIRM_DELAY_MS - 1)), now)).toBe('TOO_EARLY')
    expect(canConfirm(new Date(now.getTime() - CONFIRM_DELAY_MS), now)).toBe('ok')
  })
  it('builds intent urls', () => {
    const cfg = { handle: 'wyrmhaven', postId: '999' }
    expect(taskIntentUrl('follow', cfg)).toBe('https://x.com/intent/follow?screen_name=wyrmhaven')
    expect(taskIntentUrl('like', cfg)).toBe('https://x.com/intent/like?tweet_id=999')
    expect(taskIntentUrl('repost', cfg)).toBe('https://x.com/intent/retweet?tweet_id=999')
    expect(taskIntentUrl('comment', cfg)).toBe('https://x.com/intent/post?in_reply_to=999')
  })
})

describe('refCode', () => {
  it('is 8 Crockford base32 chars', () => {
    for (let i = 0; i < 50; i++) expect(newRefCode()).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/)
  })
})
