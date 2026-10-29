> **DRAFT for review by counsel — not legal advice — not in force.**
> Prepared by the developer to brief counsel. Facts are taken from the design spec and code; questions are open.

# Dragon Island: questions for counsel

## How to read this

- **Product:** Dragon Island, an original browser game (breed dragons, build an island, turn-based battles) with an
  optional "earn" layer paid in the project's own ERC-20 token, $DRIS, on Robinhood Chain (an Arbitrum Orbit L2).
- **Stage now:** closed beta on Robinhood Chain **testnet** (chain ID 46630): up to ~100 invited players from the
  waitlist, ~3 weeks. Testnet tokens have no value. No mainnet token exists. Mainnet launch waits for the audit and
  your answers (spec §21 step 7, §22).
- **Sources:** spec = `docs/superpowers/specs/2026-10-28-wyrmhaven-design.md` (old working name "Wyrmhaven"/$WYRM);
  token facts with code references = `token-disclosures.md` in this folder; draft player pages =
  `terms-draft.md`, `privacy-draft.md`, `risk-disclosure-draft.md`.
- **Operator entity:** `[COMPANY]` does not exist yet / is undecided. The developer is an individual
  (`[JURISDICTION]` of residence to be supplied to counsel privately).
- Each question has a number for your answers. **A** = answer needed before the testnet beta opens;
  **M** = before mainnet.

---

## 1. Entity, jurisdiction, structure

**Facts.** No company has been formed. One developer runs code, servers and the project's multisig wallet (a Safe,
planned 2-of-3 signers). The waitlist and game would be operated from `[JURISDICTION]`.

- **1.1 (A)** Should an entity be formed before the testnet beta (where testnet tokens have no value), or only before
  mainnet? Which jurisdiction and form suit a game with a token reward layer?
- **1.2 (M)** Who should be the named operator in Terms and the privacy controller? Can the Safe and the treasury be
  held by the entity, and what governance documents are needed for signers?
- **1.3 (M)** Personal liability exposure for the developer and for Safe signers before and after incorporation.

## 2. Is $DRIS, or its distribution, a security / regulated crypto-asset?

**Facts (spec §13, `token-disclosures.md`).**
- Fixed supply 1,000,000,000; no owner, no mint, not upgradeable. Minted once: 50% to a launch wallet to seed a
  public DEX pool ("fair launch", Uniswap v4), 40% to the game vault, 10% to the team, vesting linearly over
  12 months (365 days, no cliff) to the project Safe.
- **No private sale, presale or ICO is planned.** The project would itself put 500M tokens into a public pool;
  anyone could then buy on the open market.
- Utility: spend in the game store (timer skips, food, nests, level-ups, breeding odds boosts, season pass, Hoard
  building; spec §15). Spending burns 50% and keeps 50% in the vault (spec §13).
- Players can receive DRIS from the vault by selling in-game gold, season prizes and referral credits (§12, §14, §16).
- Supply only falls (burns on deposit, withdrawal and spend). Entry-fee ETH funds a buyback of DRIS into the vault
  (spec §13; off-chain, discretionary).
- Marketing rule already adopted: no promises of earnings, price, returns or airdrops (waitlist README).

**Questions.**
- **2.1 (M)** Is $DRIS likely to be a security (e.g. US Howey analysis), a financial instrument, or a crypto-asset
  under MiCA (EU) or equivalent regimes in our target markets? Which features drive the risk most (team allocation,
  buyback, burns, the project seeding the pool, "earn" marketing)?
- **2.2 (M)** Does the project seeding a DEX pool with 50% of supply count as a sale or offer by the project? Does
  it need a white paper (MiCA Title II) or a prospectus anywhere?
- **2.3 (M)** Do the burn mechanics and the ETH-funded buyback create an expectation of profit from the team's
  efforts? Should the buyback be dropped, made rule-based, or described differently?
- **2.4 (M)** Does the team allocation (10%, 12-month linear vesting to the Safe) need different disclosure or
  structure? Should a cliff or longer vesting be used?
- **2.5 (M)** Which countries' residents must be excluded from buying, receiving or withdrawing DRIS for securities
  reasons (feeds question 7)?
- **2.6 (A)** Is there any issue distributing **testnet** tokens (no value, not transferable to mainnet) during the
  beta? Can we say "testnet tokens will not convert to mainnet tokens" (that is the plan) and is that enough?

## 3. Paid odds boosts plus cash-out: gambling and loot-box laws

**Facts.**
- Breeding is random (spec §6): two parent dragons produce an egg whose rarity tier is drawn with weights (common
  70, rare 25+5·S, epic 5+2·S, legendary 1, plus a 3% recipe roll); pity after 10 commons. **Exact odds are shown
  in the UI before every breed** (§6).
- A **breeding odds boost** costs US$0.50 in DRIS for one breed and adds +10 rare / +5 epic weight (§6, §15).
- Battles are deterministic given a server seed; breeding and battles use provably fair seeds (§17).
- Dragons are database rows, not NFTs (§1); the design has no player-to-player trading, and selling a dragon gives
  only ineligible gold, which cannot be sold back for DRIS (§14).
  Rarer dragons produce more gold and win more battles; gold from habitats and battles can be sold back for DRIS
  (§14), and battles earn Season Points that rank for DRIS prizes (§12).
- So: pay token → better odds of a rarer dragon → more eligible gold and SP → more DRIS → can be withdrawn and sold.

**Questions.**
- **3.1 (M)** Does selling odds boosts, given the cash-out path through gold sell-back and prizes, make breeding a
  game of chance with a prize of money's worth (gambling) in our target markets? Which element would remove that risk
  most cheaply: removing paid boosts, making boosts earnable only with gold, removing the link from dragon rarity
  to earnings, or limiting cash-out?
- **3.2 (M)** Loot-box rules (e.g. Belgium, Netherlands, and odds-disclosure rules elsewhere): does breeding with a
  paid boost count as a paid random item? Is our odds display sufficient where disclosure is required?
- **3.3 (M)** Do the season prizes (§12; pool funded by player spend, distributed by SP thresholds and top-100
  placement) count as a lottery, prize competition or skill contest? Note there is **no free path** to SP or
  prizes: only players who paid the one-time entry fee earn SP (spec §12 "earning unlocked only";
  `apps/server/src/services/sp.ts` L75), so every prize entrant has paid (see 3.4).
- **3.4 (M)** Is the one-time ~US$1 entry fee (paid in ETH, unlocks sell-back, SP and prizes; §13) a "consideration"
  that turns prize features into gambling or a lottery?
- **3.5 (A)** For the testnet beta, where nothing has value, can boosts and prizes run as-is?

## 4. Gold sell-back and withdrawals (cash-out path)

**Facts (spec §14, §13).**
- Gold earned from habitats and battles is "eligible"; 10,000 eligible gold = US$0.05, paid as DRIS at a market
  price (30-minute TWAP, §13). Selling requires a "Hoard" building bought with DRIS (US$2-60 per level), with a daily
  limit of US$1-30, raised to cover the player's own deposits, cut when withdrawals exceed deposits (×½ above 1×,
  ×⅕ above 2×, paused above 3×).
- Withdrawal: the server signs a voucher; the player claims on-chain, 5% fee (2.5% burned). Vault-wide cap 2% of
  its balance per UTC day (§13); per-player cap 10% of that (server).
- Deposits: 2% fee (1% burned).

**Questions.**
- **4.1 (M)** Does the deposit → in-game balance → withdrawal path make the operator a custodian, money
  transmitter, e-money issuer, or crypto-asset service provider (e.g. CASP under MiCA), given balances are held
  off-chain by the server between deposit and withdrawal?
- **4.2 (M)** Is a USD-denominated gold buy-back an obligation we must honour (debt)? How must we word that it is
  capped, discretionary, can change and can stop (vault empty, daily cap, pause)?
- **4.3 (M)** Can the Terms reserve the right to change rates, limits and fees, and to pause withdrawals, without
  notice? What notice is reasonable?

## 5. KYC, AML and sanctions screening on withdrawals

**Facts.** Sign-in is wallet-only (signed message, no email). No identity checks today. Withdrawals go to the signed-in
wallet only. The server can ban accounts (forfeits earned, not deposited, balance; §16).

- **5.1 (M)** Is KYC required for withdrawals, deposits, or above a threshold? Which threshold and which provider
  approach is proportionate?
- **5.2 (A/M)** Must we screen wallet addresses against sanctions lists (OFAC SDN, EU, UN, UK) before allowing
  deposits or withdrawals, even on testnet? Is IP geo-blocking (question 7) also required for sanctioned countries?
- **5.3 (M)** If an address is flagged after it has an in-game balance, what may we do with that balance? Is the
  current ban rule (forfeit earned balance, allow withdrawing own deposits; §16) lawful, and must the Terms say so?
- **5.4 (M)** Travel-rule or record-keeping duties, and how long to keep records.

## 6. Tax

**Facts.** Players receive DRIS from the vault (sell-back, prizes, referral credits) and pay DRIS (store, Hoard).
Entry fees in ETH go to the project treasury. The team allocation vests to the Safe.

- **6.1 (M)** Do we have any reporting duty for amounts paid to players (e.g. US 1099-MISC / 1099-DA, DAC8 in the
  EU)? Does that force collecting identity or tax data?
- **6.2 (M)** How are store sales paid in DRIS, entry fees in ETH, burns, and the team allocation taxed for the
  operator? Any VAT/sales tax on in-game items sold for tokens?
- **6.3 (M)** What tax wording should the player pages use (we currently say players are responsible for their own
  taxes and we do not give tax advice)?

## 7. Countries to block (feeds `BLOCKED_COUNTRIES`)

**Facts.** Built (Phase 7 plan, Task 8), ships off by default: the server can refuse sign-in, actions and
withdrawals (HTTP 451) from a list of ISO country codes, using the country header from the CDN (Cloudflare
`CF-IPCountry`); the list is empty by default. While a list is set it fails closed: a request with no country
header (one that did not come through Cloudflare), Cloudflare's "unknown" code `XX` and its Tor code `T1` are
refused too. It is IP-based and can be bypassed with a VPN; the Terms also prohibit use from blocked countries.
Withdrawals are blocked along with sign-in and play, so a player in a country added to the list later cannot
withdraw their existing balance while the block applies.

- **7.1 (A)** Which countries must be blocked for the testnet beta (likely at least comprehensively sanctioned
  jurisdictions)? `[COUNSEL: list of ISO codes]`
- **7.2 (M)** Which additional countries for mainnet, based on questions 2, 3, 4 and 6 (e.g. where the token is a
  security, where boosts are gambling, where a licence would be needed)?
- **7.3 (M)** Is IP geo-blocking plus a Terms representation enough, or is more needed (wallet screening,
  declarations at sign-in)?
- **7.4 (M)** Should blocking apply to the waitlist site as well?
- **7.5 (A)** Blocking `/withdraw` for a newly blocked country strands the in-game balances (including deposited
  tokens) of players already there. Must withdrawals stay open for them (with sanctions or wallet screening), or is
  blocking withdrawals required? If they must stay open, for how long and on what conditions?
- **7.6 (A)** We refuse Tor (`T1`) and unknown-country (`XX`) requests while a block list is set, since their
  country cannot be checked. Is that required, acceptable, or should Tor users be allowed?

## 8. Age gating

**Facts.** No age check exists. The game has cartoon fantasy content and real-money-adjacent features (token
deposits, withdrawals, paid boosts).

- **8.1 (A)** Minimum age for the beta and mainnet: `[COUNSEL: age]` (18? higher where gambling-like rules
  apply?). Is a self-declaration at sign-in enough?
- **8.2 (M)** Do child-protection rules (COPPA, UK Age-Appropriate Design Code, GDPR Art. 8) apply if the art
  appeals to children even when we set 18+?

## 9. Personal data (GDPR and similar)

**Facts (see `privacy-draft.md` for the full inventory).**
- **Waitlist:** X (Twitter) sign-in with read-only scopes; stores X user id, handle, display name, avatar URL,
  account creation date; wallet address (proved by signature); X task completion timestamps (follow, like, repost,
  comment, honour-based); referral links between entrants; position. Admin can export a CSV of handle + wallet. X
  access tokens are not stored. Per-IP rate limits are in memory only.
- **Game server:** wallet address (the account), game state and full action log (kept for provably fair
  re-verification, §17), balances and withdrawal vouchers, on-chain events, salted SHA-256 hashes of IP address and
  of a random browser id (for referral self-dealing checks, §16), raw IP address in sign-in rate-limit keys, ban
  reason. Error reports may go to Sentry and alerts to a Discord webhook. Nightly encrypted backups to cloud
  storage (Cloudflare R2 or Backblaze B2), kept 14 daily + 8 weekly.
- On-chain data (address, deposits, withdrawals) is public and permanent.

**Questions.**
- **9.1 (A)** Is a wallet address personal data where it is linked to an X handle (the waitlist links them)? What
  lawful basis covers collecting X handle + wallet (consent? legitimate interest?), and what must the waitlist page
  say? `[DEVELOPER: tell counsel whether the waitlist is already collecting data, and since when.]`
- **9.2 (A)** May we use the waitlist list to invite beta players and later to allocate access? (No token
  allocation or airdrop is planned or promised.)
- **9.3 (A)** Are salted IP and device hashes still personal data? Is legitimate interest (fraud prevention) the
  right basis? Retention limit?
- **9.4 (A)** Is the action log (needed for provably fair re-verification) a reason to keep data for a season or
  longer, and how do we handle erasure requests when data is also on-chain or needed for anti-fraud?
- **9.5 (A)** International transfers (Sentry, Discord, Cloudflare, X, hosting provider): which mechanisms (SCCs,
  DPF) and which processor agreements do we need?
- **9.6 (A)** Do we need an EU/UK representative or a DPO at this scale?
- **9.7 (A)** Cookie / local-storage consent: the game stores a session token and a random device id in the browser;
  the waitlist uses session cookies. Is a banner needed?

## 10. Terms for the beta

**Facts.** The beta runs on testnet with invited players. Built (Phase 7 plan, Task 8), ships off by default: the
server can require players to accept the current Terms version before playing. Acceptance is a click-through: the
game shows links to the Terms, Privacy Notice and Risk Disclosure and an "Accept" button, which sends the current
version (`POST /me/terms`); the server stores only that version string against the wallet's account (no timestamp,
no signature). Changing the version asks everyone again. Sign-in, viewing the account and withdrawals are never
held back by it.

- **10.1 (A)** Do you agree the beta should require acceptance of Terms (we recommend yes), and is the attached
  `terms-draft.md` a workable base? Which sections should be beta-only?
- **10.2 (A)** Governing law, venue, dispute resolution (arbitration? class-action waiver?) `[COUNSEL]`.
- **10.3 (A)** Is click-through acceptance stored by version and wallet address sufficient evidence of assent, or
  do you want an acceptance timestamp, or a wallet-signed acceptance message (both would be code changes)?
- **10.4 (M)** Consumer-law points: refunds for store purchases paid in tokens, withdrawal rights for digital content
  (EU), unfair-terms rules on our right to change rules, ban and forfeit.

## 11. Referrals

**Facts (§16).** A referrer earns 5% of a referred player's token spend, paid from the vault's share, unless IP or
device hashes match. Current ruling: referrers who have not paid the entry fee still accrue the 5% and can use it
after entering (Phase 7 plan, ruling R2).

- **11.1 (M)** Is a spend-based referral reward a multi-level marketing / pyramid concern or a financial promotion?
  It is single level only.
- **11.2 (M)** Do referrers who post links (e.g. on X) need to disclose they are rewarded (advertising rules)?

## 12. Season prize pool

**Facts (§12).** Every 14 days, 30% of the vault's net inflows in that season (vault share of spend, vault share of
fees, buybacks, forfeited balances) is paid as DRIS: 70% split by SP thresholds (200/500/1,000/2,000 SP), 30% to the
top 100 by rank weight (101 − rank). Ranks nobody holds leave their share in the vault (ruling R1). SP come from
wins, first clears and quests, capped at 150/day.

- **12.1 (M)** Prize promotion rules: do we need official rules, registration or bonding anywhere? Is the pool,
  funded by player spend, a pooled-stakes arrangement?
- **12.2 (M)** How to word that pool size is unknown in advance and may be zero.

## 13. Provably fair randomness

**Facts (§17).** Each season has a secret; its hash is published at season start; seeds are HMAC of the secret
with player id and action number; the secret is revealed at season end so players can re-verify their action log.

- **13.1 (M)** Does publishing this scheme create a warranty that outcomes are fair, and what liability follows if a
  bug produces non-matching results? How should the Terms describe it?

## 14. Custody, keys and the Safe

**Facts (`token-disclosures.md` §3-4).** The owner Safe (2-of-3 planned) can rotate server keys, pause/unpause, set
the entry fee and burn limit. The vault has no direct owner-withdraw function, but project keys can reach vault
tokens indirectly: the signer (a project server key) can sign vouchers for any address, including one the project
controls, bounded only by the 2%-of-balance per UTC day cap; the Safe can install its own signer and do the same;
and the Safe can install its own operator, raise the burn limit and burn the whole vault. Mitigations: a 2-of-3
Safe, separate rotatable server keys, and public events on every change; there is no timelock. If the game ends,
vault tokens stay there unless paid out through vouchers or burned. Server hot keys also burn spend batches, and
the off-chain ledger records players' in-game balances.

- **14.1 (M)** Given that the project holds the off-chain ledger, can pause the vault, and through its keys can
  direct vault payouts (up to 2%/day) to any address or burn vault tokens, is the operator a custodian of player
  funds or of the vault seed? What disclosures and safeguards (timelock, independent signer, published monitoring)
  are expected?
- **14.2 (M)** What must we disclose and do on wind-down (game closes, vault still holds tokens, players hold
  in-game balances)?
- **14.3 (M)** Signer arrangements: should signer identities, jurisdictions or an independent signer be disclosed?

## 15. Marketing and naming

- **15.1 (A)** Review of player-facing wording: "play-and-earn", "rewards", "prizes", "sell gold". Which words must
  we avoid? (Current rule: no promises of earnings, returns, price, or airdrops.)
- **15.2 (M)** Trademark clearance for "Dragon Island" (classes 9 and 41) before mainnet (developer is doing first
  searches; plan item O5).
- **15.3 (M)** Rules for mentioning Robinhood Chain: the project is not affiliated with Robinhood; how should we say
  so?

## 16. Product risks we already know (spec §22) — wording only

- **16.1 (M)** Rewards are priced in USD but paid in a floating token, so a price fall drains the vault faster; the
  2% daily cap bounds it. Is the wording in `risk-disclosure-draft.md` adequate?
- **16.2 (M)** Paying players can buy power (food, level-ups, odds boosts) and win more battles, which feeds prize
  rank. Any consumer-law or fairness-claim issue, and how to disclose it?
