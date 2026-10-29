# Dragon Island Waitlist Site — Design Spec

Status: for review (2026-10-29). Lives in `apps/waitlist`. Game identity comes from `2026-10-28-wyrmhaven-design.md`.

## 1. Goal

A pre-launch waitlist page that collects real X accounts and wallets, drives engagement on one announcement post, and gives every entrant a shareable card. No game assets exist yet, so the page must look finished without illustrations and accept real art later with no code changes.

Success: a visitor can go from landing to a downloaded/posted card in under two minutes; one entry per X account and per wallet; the operator can export the list.

## 2. Decisions

| Decision | Choice |
|---|---|
| X identity | Sign in with X (OAuth 2.0 + PKCE, scopes `users.read tweet.read`). Gives a real, unique handle and avatar. We never post or keep tokens after reading the profile. |
| X tasks | **Honor-based.** Follow, like, repost, comment. Each task has Open (X intent link) and Confirm; Confirm unlocks 15 s after Open. The server records both times and rejects a confirm less than 15 s after its open. No X API reads of engagement. |
| Wallet | Connect an EVM wallet and sign a plain message (no gas, no transaction). Server verifies the signature with viem. |
| Art | **Pixel art**, the same direction as the game. Static and animated sprites generated with PixelLab, a pixel display font, pixel UI frames. All art goes through named slots (§6) so final game assets replace the generated ones without code changes. |
| Share card | Server-rendered PNG (1200×675). Download button plus "Post on X" intent with a link whose preview is the card. |
| Referrals | Invite link `?ref=<code>`; the entrant's invite count is shown. No leaderboard, no rewards promised. |
| Stack | Next.js (App Router) + React, Drizzle ORM + PostgreSQL (`pg` in prod, PGlite in tests, same as `apps/server`), viem, wagmi + Reown AppKit, `next/og` for the card. |

Honor-based tasks are easy to fake. The task timestamps are stored so that a later audit (for example a one-off X API check of finalists before launch) stays possible without changing the data model.

## 3. Page structure

One page, top to bottom:

1. **Header**: wordmark, links to sections, X link, "Join" button.
2. **Hero**: name, one-line pitch ("Breed dragons. Build your island. Battle for the season."), animated pixel island scene with hatchlings, primary CTA to the waitlist, live entrant count.
3. **Pillars**: four cards: Breed, Build, Battle, Seasons. Copy taken from the game spec in our own words.
4. **Elements strip**: the nine elements with their colour and icon slot.
5. **Waitlist module** (§4).
6. **FAQ**: what is it, which chain, when, is it free, what do you store.
7. **Footer**: socials, privacy note, "Robinhood Chain testnet" note.

Mobile first; works at 360 px. Respects `prefers-reduced-motion`.

Copy rule: no promises of earnings, token price, airdrops or allocations. "Play-and-earn" wording on this page needs a legal look before going live.

## 4. Waitlist flow

A four-step panel, the same order as the references, resumable at any step:

1. **Connect X.** Redirect to X OAuth, callback stores the entrant, sets a session cookie, returns to `/#join`. If the X account already exists, the user resumes where they left off (this is also the "already joined on another device" path).
2. **X tasks.** Four rows: Follow `@<account>`, Like, Repost, Comment on the announcement post. Open → `POST /api/tasks/:task/open` then opens the X intent in a new tab. Confirm enabled 15 s later → `POST /api/tasks/:task/confirm`.
3. **Wallet.** Connect via AppKit, sign `Dragon Island waitlist\nX: @handle\nAddress: 0x…\nNonce: <server nonce>`. `POST /api/wallet` verifies and stores the lowercase address. A wallet already bound to another X account is refused.
4. **Join.** Enabled when all four tasks are confirmed and a wallet is bound. Assigns the next waitlist number and shows the card.

After joining: card preview, Download PNG, Post on X, Copy invite link, invite count.

## 5. Share card

- Endpoint `GET /api/card/:code.png`, rendered with `next/og`, cached by `code` + art version.
- Content: wordmark, X avatar and @handle, `#<number>` on the waitlist, **starting element** (= `ELEMENTS[sha256(xUserId)[0] % 9]`), its colour theme, egg and hatchling sprites (frame 0), site URL. The pixel font is loaded into the renderer.
- `/c/:code` is a public page with `og:image` / `twitter:card = summary_large_image` pointing at the PNG, so a posted link shows the card. It also offers "Join the waitlist" with `?ref=<code>`.
- Post on X uses `https://x.com/intent/post?text=…&url=<site>/c/<code>`.

## 6. Art style and slot system

**Style.** Pixel art at a fixed base resolution, scaled by whole numbers with `image-rendering: pixelated`. Dark night-sky island palette, with the nine element colours as accents. Fonts: a pixel display font for headings and buttons, and a readable sans-serif font for body text. Both come from Google Fonts with OFL licences. UI panels and buttons use 9-slice pixel frames.

**Assets (generated now, replaced later).** PixelLab produces:
- one egg per element, static plus a 4–8 frame idle wobble;
- one hatchling dragon per element, with an idle animation;
- the hero scene: a floating island at night, with a looping animated layer (clouds or water);
- nine element icons at 16×16 and 32×32;
- UI frame and button tiles.

Animations ship as horizontal sprite-sheet PNGs and are played with CSS `steps()`. Under reduced motion the first frame shows. Every asset is stored under `public/art/<artVersion>/` with a `manifest.json` (file, size, frames, fps). The prompt used for each asset is recorded in `apps/waitlist/art/prompts.md`. Prompts describe our own designs only. They never name another game or ask for its style (originality rule).

**Slots.** `src/art/slots.ts` is the only place art is chosen:

```ts
type Element = 'fire'|'water'|'earth'|'nature'|'electric'|'ice'|'metal'|'dark'|'light'
interface Sprite { src: string; w: number; h: number; frames: number; fps: number }
interface ArtSet {
  version: string                          // busts the card cache
  hero: { base: Sprite; layers: Sprite[] }
  egg: Record<Element, Sprite>
  hatchling: Record<Element, Sprite>
  elementIcon: Record<Element, Sprite>
  ui: { panel: Sprite; button: Sprite }
}
```

To swap in real art: add a new folder, build its `ArtSet` from that folder's manifest and set `ACTIVE_ART`. The share card uses frame 0 of each sprite, scaled by whole numbers. Element colours live in one token file shared by the page and the card. If a sprite fails to load, a flat element-coloured block takes its place, so the page never breaks.

## 7. Data

```
entrants(
  id uuid pk, x_user_id text unique, x_handle text, x_name text, x_avatar_url text,
  x_created_at timestamptz, wallet text unique null, wallet_signed_at timestamptz null,
  position int unique null,        -- set on Join
  element text, ref_code text unique, referred_by uuid null → entrants.id,
  created_at timestamptz, joined_at timestamptz null)
task_events(entrant_id uuid, task text check in (follow,like,repost,comment),
  opened_at timestamptz, confirmed_at timestamptz null, primary key (entrant_id, task))
wallet_nonces(nonce text pk, entrant_id uuid, expires_at timestamptz)
```

`position` comes from a sequence taken at Join time, inside the same transaction. Session = signed, httpOnly cookie holding the entrant id (`jose`, HS256, 30 days).

## 8. API

| Route | Purpose |
|---|---|
| `GET /api/auth/x` / `GET /api/auth/x/callback` | OAuth start / finish |
| `POST /api/auth/logout` | clear session |
| `GET /api/me` | entrant state for the panel |
| `POST /api/tasks/:task/open`, `/confirm` | honor tasks with the 15 s rule |
| `GET /api/wallet/nonce`, `POST /api/wallet` | signature binding |
| `POST /api/join` | assign position |
| `GET /api/stats` | public entrant count (cached 60 s) |
| `GET /api/card/:code.png` | share card |
| `GET /api/admin/export` | CSV (handle, wallet, position, element, invites, task times); bearer `ADMIN_TOKEN` |

All bodies validated with zod. Errors return `{ error: CODE }` with 4xx.

## 9. Abuse limits (cheap ones only)

- One entry per X account and per wallet (unique keys).
- X accounts younger than 30 days are refused at callback (from `created_at` in the profile; configurable).
- Per-IP rate limit on auth, wallet and join routes (in-memory, per instance).
- Self-referral and referral after joining are ignored; `referred_by` is set once at first sign-in.

## 10. Config

`.env` (never committed; `.env.example` lists keys): `DATABASE_URL`, `SESSION_SECRET`, `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_ACCOUNT_HANDLE`, `ANNOUNCEMENT_POST_ID`, `NEXT_PUBLIC_REOWN_PROJECT_ID`, `NEXT_PUBLIC_SITE_URL`, `ADMIN_TOKEN`, `MIN_X_ACCOUNT_AGE_DAYS`.

X API cost: one profile read per sign-in (pay-per-use, about $0.01 each). Check the current price on docs.x.com before launch.

## 11. Testing

- Vitest units: element pick, signed-message format and verify, task timing rule, referral rules, position assignment.
- Route tests against PGlite with X OAuth mocked: full happy path, duplicate wallet, early confirm, join before tasks done.
- Card render test: PNG returned with correct size for each element.
- Playwright smoke: page loads, waitlist panel steps render, card page has OG tags.

## 12. Out of scope

Leaderboards, XP, partner/collab applications, music, i18n, real engagement verification, email capture. Hosting choice (e.g. Vercel + managed Postgres) is decided at deploy time.
