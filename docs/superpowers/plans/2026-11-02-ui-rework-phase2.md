# UI Rework Phase 2 (pixel UI kit) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One pixel UI kit (fonts, frames, buttons, cards, pills, bars, bubbles, badges) that every dialog uses, replacing the dark navy panels, the squished close button, the browser scrollbar and the non-pixel body font.

**Architecture:** Kit components live in `apps/web/src/ui/kit/` as small React components styled by `apps/web/src/styles/kit.css`. Each piece is drawn in CSS first and switches to PixelLab art when its `ui.kit.*` manifest key exists, through the existing `hudSkin` CSS-variable mechanism. Existing `Panel`, `ActionButton`, `.btn`, close button and toasts are restyled through the kit, so every current dialog picks up the new look without rewriting its contents; Phases 3-5 compose new screens from the kit.

**Tech Stack:** React 19, CSS, Vitest + Testing Library, Playwright, `@fontsource/silkscreen` and `@fontsource/pixelify-sans` (both OFL-1.1).

**Spec:** `docs/superpowers/specs/2026-11-01-ui-rework-design.md` (Phase 2 table, ground rule "One font family", Art list item 2).

## Global Constraints

- Same layout, our skin: match the references' positions, sizes and states; never copy their art, logo or text. Reference images are not committed.
- One font family: a pixel display font for titles and buttons and a matching pixel body font. No browser default font anywhere.
- Game rules unchanged. No game-core change in this phase.
- Every component falls back to drawn shapes until its PixelLab art lands. Art loads through the manifest.
- Pixel art at integer scale only (`image-rendering: pixelated`, sizes multiples of the sprite).
- Stage by explicit path. Conventional commits. Old tests are updated, never skipped.

## Rulings made here

| # | Ruling | Why |
| --- | --- | --- |
| P1 | Fonts are self-hosted from `@fontsource` (Silkscreen 400/700 display, Pixelify Sans 400/600 body), and the Google Fonts link goes. Fallback stack is `monospace` only after them. | A blocked or slow Google request showed Courier New / system-ui (review image-8, image-9). |
| P2 | Inside a light frame the palette flips by scoped CSS variables (`--text`, `--text-muted`, `--bg-panel`, `--bg-panel-2`, `--border`) on `.panel`, so existing panel contents read dark-on-light without per-panel edits. | Twenty-odd panels; one rule. |
| P3 | `.btn` becomes a blue pill; `.btn--primary` yellow, `.btn--danger` red, `.btn--ghost` grey, `:disabled` grey. New code uses `<PillButton color>`. Green and purple exist only on `PillButton`. | Keeps old call sites working with the reference's colours. |
| P4 | The old dark `ui.panel` and `ui.close` art stops being applied to dialogs (the `skin-close` rule and `Panel.frameSrc` go). New keys are `ui.kit.*`. | That art is navy; it would fight the light frame. |
| P5 | A dev and test gallery at `#/kit` renders every kit component in every state. | One page for screenshots, the font check and visual review. |
| P6 | Rarity shield letters: C, U, R, E, L. | Our five rarities. |

## Review Focus

1. A long title on the plank (a long dragon name): the plank widens up to the frame and then truncates with an ellipsis, never wrapping or overlapping the close button. Test in Task 3.
2. A dialog taller than a landscape phone (844×390): the frame's body scrolls with the pixel scrollbar while the plank and close stay visible. Test in Task 3 and the e2e in Task 6.
3. Fonts not yet loaded (first paint, offline): text uses the self-hosted font files from the bundle, never a remote request; the e2e font check waits for `document.fonts.ready`. Test in Task 1.
4. Disabled price buttons: an unaffordable price shows a red number, and a disabled pill shows and is described by its reason (as `ActionButton` does today; it stays a native `disabled` button, which 126 existing assertions rely on). Test in Task 2.
5. Keyboard: close, back, help, pills and round actions show a visible focus ring on the light frame (the old white ring vanishes on cream). Test in Task 2.

---

### Task 1: Self-hosted pixel fonts

**Files:**
- Modify: `apps/web/package.json`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/styles/tokens.css`
- Create: `apps/web/src/styles/fonts.ts`
- Test: `apps/web/test/fonts.test.ts`, `apps/web/e2e/helpers.ts`, `apps/web/e2e/hud.spec.ts`

**Interfaces — Produces:** `--font-display: 'Silkscreen', monospace`, `--font-body: 'Pixelify Sans', monospace`; e2e helper `expectPixelFonts(page: Page): Promise<void>`.

- [ ] **Step 1: Failing test** `fonts.test.ts`: reads `index.html` and asserts no `fonts.googleapis.com`; reads `tokens.css` and asserts `--font-display` starts with `'Silkscreen'` and `--font-body` starts with `'Pixelify Sans'`, and neither stack names `Inter`, `Courier New`, `system-ui` or `sans-serif`; imports `fonts.ts` without throwing.
- [ ] **Step 2: Run** `pnpm --filter @wyrmhaven/web test fonts` → FAIL.
- [ ] **Step 3:** add the two `@fontsource` packages; `fonts.ts` imports `@fontsource/silkscreen/400.css`, `/700.css`, `@fontsource/pixelify-sans/400.css`, `/600.css`; `main.tsx` imports `./styles/fonts`; drop the Google links from `index.html`; update tokens.
- [ ] **Step 4:** `expectPixelFonts(page)`: after `document.fonts.ready`, walk every visible element with a non-empty own text node and assert the first family of its computed `font-family` is Silkscreen or Pixelify Sans, and that `document.fonts.check('12px "Pixelify Sans"')` and Silkscreen are true. Call it in `hud.spec.ts` on the island and with a dialog open.
- [ ] **Step 5: Run** unit test PASS; commit `feat(web): self-hosted pixel display and body fonts`.

### Task 2: Kit buttons and price label

**Files:**
- Create: `apps/web/src/ui/kit/buttons.tsx`, `apps/web/src/styles/kit.css`
- Modify: `apps/web/src/main.tsx` (import kit.css), `apps/web/src/styles/tokens.css` (`.btn` family per P3), `apps/web/src/ui/Panel.tsx` (`ActionButton` keeps its API, renders a kit pill)
- Test: `apps/web/test/kit-buttons.test.tsx`

**Interfaces — Produces:**
- `type PillColor = 'blue' | 'yellow' | 'green' | 'purple' | 'grey' | 'red'`
- `PillButton(props: { color?: PillColor; children; onClick?; disabled?; reason?; id?; ariaLabel?; small? })` → `<button class="kit-pill kit-pill--{color}">`; disabled forces grey, keeps the native `disabled` attribute and `aria-describedby` to the visible reason.
- `PriceTag({ amount: number; currency: 'gold' | 'food' | 'dris' | 'usd'; affordable?: boolean })` → number via `formatGold`/`formatMicroUsd` plus the currency icon; `kit-price--short` (red number) when `affordable === false`.
- `CloseButton({ onClick, label = 'Close' })`, `BackButton({ onClick, label = 'Back' })`, `HelpButton({ onClick, label = 'Help' })` → square buttons, 32 px at 1×, 40 px on wide screens.

- [ ] **Step 1: Failing tests:** each colour renders its class; disabled pill is grey, focusable, described by its reason; `PriceTag` with `affordable={false}` has `kit-price--short` and the formatted number `12,500`; `CloseButton` has `aria-label="Close"` and equal CSS width and height (read from kit.css custom properties `--kit-close-size`); `.btn--primary` still exists in tokens.css (old call sites).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Look: pills are rounded rectangles with a 2 px ink outline, a lighter top highlight row and a darker 4 px bottom edge; pressed moves 2 px down. Close is a red rounded square, orange rim, white X; back is orange with a white left arrow; help is blue with "?". Focus ring: 3 px `--kit-focus` (#1f6feb) outline, 2 px offset, on all kit buttons.
- [ ] **Step 4: Run** → PASS; commit `feat(web): kit pill, price, close, back and help buttons`.

### Task 3: Dialog frame, full-screen frame and scrollbar

**Files:**
- Create: `apps/web/src/ui/kit/frames.tsx`
- Modify: `apps/web/src/ui/Panel.tsx`, `apps/web/src/hud/Dialog.tsx`, `apps/web/src/styles/kit.css`, `apps/web/src/styles/hud.css` (remove `.skin-close` and the navy `.panel` rules)
- Test: `apps/web/test/kit-frames.test.tsx`; update `panels.test.tsx`, `hud.test.tsx` where they assert the old close button or frame

**Interfaces — Produces:**
- `DialogFrame({ title: string; badge?: string; onClose?: () => void; children; wide?: boolean })` → `<section class="kit-frame panel" aria-label={title}>`, a `<h2 class="kit-plank">` on the top edge, an optional `<span class="kit-badge">`, `CloseButton` at the top-right corner, `.kit-frame__body` that scrolls.
- `FullScreenFrame({ title; badge?; onClose?; onBack?; onHelp?; backdrop?: 'scene' | 'wood' | 'parchment'; children })` → covers the viewport, plank top centre, back/close top right, help beside it.
- `Panel` keeps `{ title, children, onClose }` and gains `badge?: string`; it renders `DialogFrame`. `frameSrc` is removed (P4).
- Pixel scrollbar: `.kit-scroll` (and every `.kit-frame__body`) uses `scrollbar-width`/`scrollbar-color` plus `::-webkit-scrollbar*` rules: 12 px wooden track, chunky thumb with ink outline.

- [ ] **Step 1: Failing tests:** `DialogFrame` renders the title in `.kit-plank` and a `.kit-badge` with "2/4"; close calls `onClose`; without `onClose` there is no close button; the body has class `kit-scroll`; the plank has `text-overflow: ellipsis` in kit.css (string check); `FullScreenFrame` renders back and help only when their handlers are given; `Panel` with `badge` passes it through.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Light panel `#f3ead2`, inner bevel `#fffaf0` top-left and `#c9bc9a` bottom-right, 3 px grey `#6b6f7a` border with ink outline; plank is a wooden board (`#b7793f` with darker grain lines and ink outline) centred over the top edge, title in display font, white with ink outline. Scoped palette per P2 on `.panel`. `Dialog` leaves room above the frame for the plank (padding-top 18 px).
- [ ] **Step 4: Run** the web suite; fix the old tests that relied on the navy frame or the ghost close button, by asserting on roles and labels.
- [ ] **Step 5:** commit `feat(web): light dialog frame with plank title, full-screen frame and pixel scrollbar`.

### Task 4: Display pieces

**Files:**
- Create: `apps/web/src/ui/kit/pieces.tsx`
- Modify: `apps/web/src/styles/kit.css`, `apps/web/src/ui/Toast.tsx`
- Test: `apps/web/test/kit-pieces.test.tsx`, update `toasts.test.tsx`

**Interfaces — Produces:**
- `RoundAction({ icon: ReactNode; label: string; onClick?; timer?: string; locked?: boolean; badge?: string; disabled? })` → white rounded square, orange ring, icon, outlined label below, timer chip above, lock badge corner.
- `KitCard({ title: string; elements?: Element[]; rarity?: Rarity; art?: ReactNode; footer?: ReactNode; lockedLevel?: number; children? })` → when `lockedLevel` is set: greyed, lock icon, text `Required level {n}`, footer hidden.
- `ResourcePill({ icon: ReactNode; value: string; onPlus?: () => void; plusLabel?: string })`.
- `ProgressBar({ value: number; max: number; label?: string })` → `role="progressbar"`, `aria-valuenow/max`, green fill, label centred.
- `Bubble({ icon: ReactNode; label: string; onClick? })` → white bubble, ink outline, tail.
- `ElementRibbon({ element: Element })` (colour from `--el-*`), `RarityShield({ rarity: Rarity })` (letter per P6). Stars reuse the existing `Stars` in `hud/ArtMark.tsx`.
- `Tooltip({ text: string; children })`; toasts render as `.kit-toast` (light rounded panel, body font, error variant with red rim).

- [ ] **Step 1: Failing tests:** one per component on its role, label and state classes (locked card text `Required level 12`, progress bar clamps `value` to `[0, max]`, shield letter `E` for epic, ribbon text is the element's display name); toasts have class `kit-toast`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5:** commit `feat(web): kit round action, card, resource pill, progress bar, bubble, ribbon, shield, stars, tooltip and toast`.

### Task 5: Kit art slots and the gallery

**Files:**
- Modify: `apps/web/src/hud/skin.ts`, `apps/web/src/App.tsx`, `apps/web/src/styles/kit.css`
- Create: `apps/web/src/pages/KitGallery.tsx`, `docs/art/ui-rework-p2-art-list.md`
- Test: `apps/web/test/kit-skin.test.ts`, `apps/web/test/kit-gallery.test.tsx`

**Interfaces — Produces:** manifest keys and their CSS hooks:
`ui.kit.frame` (9-slice), `ui.kit.plank` (9-slice), `ui.kit.close`, `ui.kit.back`, `ui.kit.help`, `ui.kit.pill.{blue,yellow,green,purple,grey,red}` (9-slice), `ui.kit.round`, `ui.kit.lock`, `ui.kit.card`, `ui.kit.resource`, `ui.kit.plus`, `ui.kit.scroll.track`, `ui.kit.scroll.thumb`, `ui.kit.bubble`, `ui.kit.bar`, `ui.kit.ribbon`, `ui.kit.shield`; each becomes `--kit-<name>` and class `skin-kit-<name>` from `hudSkin`.

- [ ] **Step 1: Failing tests:** `hudSkin` with a `ui.kit.close` sprite returns `--kit-close` and class `skin-kit-close`, and without it neither; `KitGallery` renders one of every component and every pill colour.
- [ ] **Step 2: Run** → FAIL. **Step 3:** extend `PIECES`; kit.css applies each art var only under its skin class (border-image for 9-slices at 2×, integer scale); `App` renders `KitGallery` at `#/kit`.
- [ ] **Step 4:** art list doc lists every key, size and 9-slice insets, for PixelLab. If `PIXELLAB_TOKEN` is set, generate them and add to `public/art/v1/manifest.json`; otherwise the drawn look ships.
- [ ] **Step 5: Run** → PASS; commit `feat(web): kit art slots and the #/kit gallery`.

### Task 6: E2E, playtest, screenshots and report

**Files:**
- Create: `apps/web/e2e/kit.spec.ts`, `docs/superpowers/reports/2026-11-02-ui-rework-phase2-report.md`, `docs/art/ui-p2-*.png`
- Modify: e2e specs that relied on the old close button or panel look

- [ ] **Step 1:** `kit.spec.ts`: open `#/kit` at 1920×1080 and 844×390, `expectPixelFonts`, close button's box is square, a long-content frame scrolls its body with plank and close still in view, Tab reaches each kit button with a visible outline.
- [ ] **Step 2:** full web e2e suite green.
- [ ] **Step 3:** `pnpm playtest` through place, move, collect, hatch, grow, buy a plot, clear an obstacle, and open every dialog; no page errors.
- [ ] **Step 4:** screenshots at 1920×1080 and 844×390 of the gallery and of each dialog; the report lists results, rulings P1-P6, and what differs from the references.
- [ ] **Step 5:** `pnpm -r typecheck` and all unit suites; commit and push.
