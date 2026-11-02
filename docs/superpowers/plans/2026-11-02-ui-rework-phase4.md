# UI Rework Phase 4 (selecting things on the island) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tap on a building selects it (yellow footprint outline, a row of round action buttons bottom right with its name above the last one) instead of opening a dialog; collect bubbles and progress bars float over the island; after hatching, valid habitats are outlined.

**Architecture:** A pure `actionRow(state, target, nowMs): ActionRow | null` in `apps/web/src/hud/actionRow.ts` decides the buttons for each selected thing and state (the design's Phase 4 table), each button an intent: run a `ClientAction`, open a dialog, or start Move. `ActionBar.tsx` renders it with the kit's `RoundAction`. `IslandScene` draws the selection outline, bubbles and bars from a pure `overlayModel(state, nowMs)` in `apps/web/src/game/overlayModel.ts`. The old attention column goes (ruling Q1 of Phase 3).

**Tech Stack:** React, Phaser 3, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-01-ui-rework-design.md` (Phase 4 table, Art list item 4).

## Global Constraints

- Same layout, our skin. Game rules unchanged; every button maps to an existing action or dialog.
- Info and Upgrade open the existing panels until Phase 5 replaces them with their own layouts.
- Hidden until built: Storage (Phase 5), Rebreed if game-core has no rebreed action.

## Rulings made here

| # | Ruling |
| --- | --- |
| A1 | A tap on a building, habitat, farm, Hatchery, breeder or obstacle selects; a tap on empty land, Escape or the same object again deselects. A tap on a dragon selects its habitat. A tap on a locked plot still opens Expand (its panel). |
| A2 | Info opens the object's existing panel; Upgrade opens the same panel scrolled to its upgrade section, until Phase 5. |
| A3 | Collect bubbles show over a habitat when its stored gold is at least 1, over a ready farm, over a finished clear; one tap collects without selecting. |
| A4 | Get Egg opens the Shop on its dragon list (eggs are bought there today). |
| A5 | After a hatch with a species to place, habitats that can hold it are outlined with a bouncing arrow, others dim, Cancel bottom right; a tap on an outlined habitat places it. This reuses the existing place-dragon action. |

## Review Focus

1. Selecting, then opening a dialog from the row, then closing it: the selection stays and the row comes back.
2. 844×390: the row (up to 6 buttons) fits bottom right without covering the zoom slider or Battle/Shop.
3. A timer finishing while selected: the row switches state (Speed Up → Collect) without a re-tap.
4. Move from the row: the row hides during placement and returns on Cancel/OK.
5. Bubbles at zoom 1 and on a crowded island stay tappable and never take the tap meant for a building beneath (bubble wins only within its own box).

---

### Task 1: actionRow model — tests per row of the design table (habitat any; hatchery empty/hatching/ready; farm idle/growing/ready; breeder; obstacle not started; locked plot → none). Commit `feat(web): action row model`.
### Task 2: ActionBar and selection flow — `ActionBar` bottom right with name label; selection replaces dialog-on-tap; Escape/empty tap deselects; old e2e that expected a dialog on tap use the row's Info. Commit `feat(web): tap selects and shows the action row`.
### Task 3: Island overlays — selection outline, bubbles (A3), progress bars under timers; remove the attention column. Commit `feat(web): bubbles, bars and selection outline on the island`.
### Task 4: Post-hatch placement highlight (A5). Commit `feat(web): outlined habitats after hatching`.
### Task 5: Verify and report — suites, playtest, screenshots next to each reference, report `docs/superpowers/reports/2026-11-02-ui-rework-phase4-report.md`.
