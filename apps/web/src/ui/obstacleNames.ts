import type { ObstacleKind, PlayerState } from '@wyrmhaven/game-core'

/** How the player reads each obstacle: the one place the panels, the HUD shortcuts and the Store share. */
export const OBSTACLE_NAMES: Record<ObstacleKind, string> = {
  ancientTree: 'Ancient Tree', boulder: 'Boulder', largeRock: 'Large Rock', tree: 'Tree', smallRock: 'Small Rock', bush: 'Bush',
}

/** `Clearing Ancient Tree` for the obstacle with this id; plain `Clearing` if it is not in the state. */
export function clearingLabel(s: PlayerState, obstacleId: string): string {
  const o = s.islands.obstacles.find(x => x.id === obstacleId)
  return o ? `Clearing ${OBSTACLE_NAMES[o.kind]}` : 'Clearing'
}
