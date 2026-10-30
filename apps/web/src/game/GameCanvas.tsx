import { useEffect, useRef } from 'react'
import type Phaser from 'phaser'
import type { GameArtSet } from '../art/types'
import { useAction } from '../state/actions'
import { useMe } from '../state/me'
import { presetOf } from '../state/preset'
import type { Bridge } from './bridge'
import { createGame } from './config'

/** Mounts the Phaser game once and streams state, time and motion preference into the bridge. */
export function GameCanvas({ bridge, art }: { bridge: Bridge; art: GameArtSet }) {
  const host = useRef<HTMLDivElement>(null)
  const game = useRef<Phaser.Game | null>(null)
  const me = useMe()

  useEffect(() => {
    if (!host.current || game.current) return
    bridge.setArt(art)
    bridge.setClock(Date.now())
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    bridge.setReducedMotion(mq?.matches ?? false)
    const onMq = (e: MediaQueryListEvent) => bridge.setReducedMotion(e.matches)
    mq?.addEventListener?.('change', onMq)
    game.current = createGame(host.current, bridge)
    // Playwright drives the canvas through the bridge (the scene emits the same events on a click); test wallet builds only.
    if (import.meta.env.VITE_TEST_WALLET === '1') (window as unknown as { __bridge?: Bridge }).__bridge = bridge
    const tick = setInterval(() => bridge.setClock(Date.now()), 1000)
    return () => {
      clearInterval(tick)
      mq?.removeEventListener?.('change', onMq)
      game.current?.destroy(true)
      game.current = null
    }
  }, [bridge, art])

  // A tap on a gold badge collects that habitat's Gold; the action hook reports failures as toasts.
  const { run } = useAction()
  const runRef = useRef(run)
  runRef.current = run
  useEffect(() => bridge.on('collectGold', e => { void runRef.current({ type: 'collectGold', habitatId: e.habitatId }) }), [bridge])

  // The preset goes first so the redraw the state triggers already uses it.
  useEffect(() => {
    bridge.setPreset(presetOf(me.data))
  }, [bridge, me.data?.game?.preset])

  useEffect(() => {
    bridge.setState(me.data?.state ?? null)
  }, [bridge, me.data?.state])

  return <div ref={host} className="game-canvas" aria-hidden="true" />
}
