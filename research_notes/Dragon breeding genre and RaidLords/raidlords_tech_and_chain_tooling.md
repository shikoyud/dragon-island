# RaidLords technical stack, on-chain footprint, and Robinhood Chain game-dev tooling (as of 2026-10-28)

Method note: RaidLords facts below come from (a) the public guide, (b) a read-only look at the public page source and JS files served by raidlords.com (`/`, `/config.js`, `/game/wallet.js`, `/game/swap.js`, `/game/sim.js`), (c) read-only JSON-RPC calls (`eth_call`, `eth_getCode`, `eth_getStorageAt`, `eth_getLogs`) against the official public RPC `https://rpc.mainnet.chain.robinhood.com`, (d) the DexScreener public API, and (e) Sourcify. Both official block explorers (robinhoodchain.blockscout.com and robin.etherscan.io) returned a Cloudflare challenge or HTTP 403 to automated requests, so explorer-only data (verified-source badges, holder counts, explorer tx counts) could not be read. No wallet was connected and nothing was signed or sent. Code comments quoted here are the developer's own words, served publicly in the page source.

## Q1. What RaidLords' guide/docs say about the tech: on-chain vs server-side, and how combat is validated

### Takeaway
RaidLords is a web game with an off-chain (Supabase/Postgres) game server and very little on-chain logic. Only money moves on chain: the one-time $1 ETH entry, ETH War Pass purchases, RAID deposits into a vault, voucher-based withdrawals from the vault, burns, and buying RAID through the Pons launch curve or Uniswap v4. Everything else is server-side: building, raids, matchmaking, clans, gold, and selling gold for tokens. Raids are simulated deterministically in the browser, and a server function replays the player's deploy log to check the result.

### Cited Findings
- The guide calls RaidLords "a village-building strategy game on Robinhood Chain". Sign-in is "Connect a wallet on Robinhood Chain and sign a free message (no gas)." — [RaidLords guide](https://raidlords.com/guide/)
- **$1 entry:** "Every lord pays $1 once, in ETH on Robinhood Chain, before the village opens… The game checks the payment on chain in about a minute. The entry is what lets you sell gold for tokens and win prizes." — [RaidLords guide](https://raidlords.com/guide/)
- **Vault model (from the guide):**
  - Deposits are "one transfer in your wallet" and count "as soon as the chain confirms it, in seconds", with a 2% deposit fee.
  - After that, "Spending in the game is then instant, with no wallet prompt and no gas."
  - Withdrawals start at 100 tokens and carry a 5% fee. Players then "claim it: one transaction from your own wallet". If the vault has hit its daily payout limit, the claim waits until 00:00 UTC.
  - Source: [RaidLords guide](https://raidlords.com/guide/)
- **Burns:** "Half of every token spent in the game is burned on chain; the other half goes to the reward vault, which pays for gold sales and prizes." — [RaidLords guide](https://raidlords.com/guide/)
- **Off-chain earning:**
  - Gold is sold for tokens at a fixed rate: "1,000 gold = $0.08, paid in tokens at the token's price of the moment".
  - New lords can sell $1 of gold in their first 24 hours. After that the daily limit is set by the Royal Mint level or by how much the player has "put in" (the dollar-pegged payout cap is enforced server-side).
  - Every price "is set in dollars and paid in tokens at the day's price."
  - Source: [RaidLords guide](https://raidlords.com/guide/)
- **Backend:** The page source routes all game calls to Supabase:
  - `/rpc/sg_x` maps to PostgREST `/rest/v1/rpc/api_x`.
  - `/auth/*` maps to the Edge Function `wallet-auth`.
  - `/battle/finish` maps to the Edge Function `battle-finish`.
  - Other Edge Functions are `vault`, `social-check`, `champ-arena` and `champ-duel`.
  - `config.js` lists about 200 `api_*` Postgres RPC functions, including admin ones such as `api_admin_economy` (params `gold_usd_k`, `cap_mult`, `paused`, `burn_pct`) and `api_admin_vault_assign`.
  - Sources: [raidlords.com page source](https://raidlords.com/), [config.js](https://raidlords.com/config.js)
- **Combat validation:**
  - The `sim.js` header reads: "SiegeSim: deterministic battle simulation shared by the browser (live play) and the server (replay check). Rules for determinism: integer world coordinates (milli-units), fixed 30 ticks/s, no Math.random / Date, no transcendental Math functions… only + - * / and an exact integer sqrt." It uses a seeded PRNG and a 3-minute cap (`MAX_TICKS = 180 * TPS`) on a hex grid. — [game/sim.js](https://raidlords.com/game/sim.js)
  - At the end of a battle the client shows "Checking the battle… The server replays your deploys." It posts `{battle_id, log, hash}` to `/battle/finish`, and the reply is either a result or "Battle rejected". — [raidlords.com page source](https://raidlords.com/)
- **Withdrawals as vouchers:** A page-source comment describes a withdrawal as "a signed running total from the `vault` function that the player's own wallet hands to the vault contract (RaidClaim), so they pay that gas". It also says "a voucher pays `cumulative - claimed[account]` and then sets claimed[account] = cumulative, so any number of vouchers for one total pay it once". The same comment calls this the vault model, "owner's decision 2026-10-25, the Stonewatch system". — [raidlords.com page source](https://raidlords.com/)
- **RaidClaim revert reasons:** The client maps custom errors to messages, which shows what the contract enforces:
  - a daily payout limit ("paid out its limit for today")
  - vault top-up needed
  - paused withdrawals
  - expired vouchers
  - `NothingToClaim`
  - bad signatures
  - per-wallet holds ("Withdrawals from this wallet are on hold")
  - Source: [raidlords.com page source](https://raidlords.com/)
- **Anti-cheat policy:** "Bots, scripts, macros and any automated play are not allowed." The guide does not describe how this is detected. — [RaidLords guide](https://raidlords.com/guide/)

### Inferences
- The game is server-authoritative with a custodial vault. All game state lives in Postgres, and the chain is used only for entry, the token, deposits, payouts and burns. Combat cannot be trusted to the client because the server re-simulates the submitted deploy log with the same deterministic code. This design pattern carries over directly to a dragon-breeding game: breeding RNG, timers and battles could all run server-side, with the chain used only for value and ownership.
- Because a deposit is just an ERC-20 transfer to the vault, the server must match on-chain transfers to players. The UI handles "That came from a wallet you do not play with", and the admin `api_admin_vault_assign` exists for manual crediting. This is operational overhead to plan for.
- Leftover UI text in the source ("There is nothing to deposit: your tokens stay in your own wallet. Allow the game once…" plus an `approve(spender)` flow) suggests an earlier allowance-and-pull model. The comments say this was switched to the deposit-vault model on 2026-10-25, the day before launch.

### Gaps
- The guide says nothing about how the server picks raid targets, stores defender layouts or detects bots. The server code (`server/vault.sql` and the Edge Functions) is not public.
- The destination address for the $1 ETH entry and the War Pass ETH payments is not exposed in static source; it comes from the server-provided `api_entry_quote`. I did not call RaidLords' backend.

## Q2. Contract addresses and on-chain footprint (verification, standards, proxies, owners, activity)

### Takeaway
RaidLords appears to have deployed only two contracts of its own:
- the RAID ERC-20, launched through the Pons V2 launchpad: fixed 1B supply, no owner, no mint, not a proxy;
- a custom vault/claim contract ("RaidClaim"), owned by a single EOA and pausable.

Swaps use Uniswap v4 (PoolManager and Universal Router) and the Pons V2 hook. There are no NFTs (ERC-721/1155). Neither RaidLords contract is verified on Sourcify; Blockscout and Etherscan verification status could not be checked. Many copycat "RaidLords/RAID" tokens exist on the chain.

### Cited Findings
- **Official RAID token:** `0xD56A6C45941Ee8aae31ce6A30Bd049e0f7489CBD` (name "RaidLords", symbol "RAID").
  - DexScreener lists this address with website raidlords.com and docs raidlords.com/guide.
  - Its main pool is a Uniswap v4 RAID/ETH pool, `0xeba5c93b…0d656`, created 2026-10-26 15:48 UTC.
  - At fetch time: price ≈ $0.000231, FDV ≈ $215.9K, ETH-pool liquidity ≈ $43.3K. A RAID/USDG v4 pool also exists.
  - Sources: [DexScreener API search](https://api.dexscreener.com/latest/dex/search?q=RaidLords), [DexScreener pair](https://dexscreener.com/robinhood/0xeba5c93b5adb45487d6daf9661632ba7e663011654dd9ccf561a1efbe490d656)
- **Copycats:** DexScreener shows more than 15 other tokens on Robinhood Chain named "RaidLords"/"RAID" (for example `0xf71236bd…9A69` and `0x74b349ED…a38a`), all without website links. One unrelated "CHAINRAIDERS AMM" token also uses the RAID symbol. — [DexScreener API search](https://api.dexscreener.com/latest/dex/search?q=RAID)
- **RAID token, on-chain reads** (my reads via the [official public RPC](https://rpc.mainnet.chain.robinhood.com)):
  - Standard: ERC-20, 18 decimals, totalSupply exactly 1,000,000,000 RAID.
  - `owner()` reverts. The bytecode has no `mint` selector but does have `burn(uint256)` and `burnFrom`.
  - The EIP-1967 implementation slot is zero, so it is not an upgradeable proxy. Runtime code is about 3.2 KB.
  - The whole supply was minted in one event at block 98,529,096 (2026-10-26 15:47:44 UTC), tx `0x3dd3c674…8029`.
  - That tx was sent by `0x3883fb5a4abfdf91e63936a5c5393deaac998b01` to `0xe33E9E479dF8802cb0866d5d05258bEc4cF62948` with 2.2905 ETH attached (an initial buy).
- **Launchpad:** `0xe33E9E47…2948` is Sourcify-verified (exact match, verified 2026-08-04) as `PonsV2LaunchAndBuy`. The pool hook `0xe5e702641ea86f4ae6cc3cdaed2b886f976be044` is Sourcify-verified as `PonsV2MemeHook`. RAID itself is not on Sourcify. — Sources: [Sourcify launch contract](https://sourcify.dev/server/v2/contract/4663/0xe33e9e479df8802cb0866d5d05258bec4cf62948), [Sourcify hook](https://sourcify.dev/server/v2/contract/4663/0xe5e702641ea86f4ae6cc3cdaed2b886f976be044), [Sourcify RAID (no match)](https://sourcify.dev/server/v2/contract/4663/0xD56A6C45941Ee8aae31ce6A30Bd049e0f7489CBD)
- **Pons background:** Pons is a meme-coin launchpad on Robinhood Chain that deploys fixed 1B-supply tokens. — [Decrypt](https://decrypt.co/377349/pons-robinhood-chain-meme-coin-token-factory)
- **In-game swap code** (`swap.js`):
  - It buys RAID "while it is on its Pons launch curve: the curve's buy(quoteIn, minTokensOut, to)… once it graduated (4.2 ETH): its Uniswap v4 pool (ETH / token, Pons hook, fee 0, tick spacing 200) through Uniswap's Universal Router".
  - It hardcodes Universal Router 2.1.2 `0x204FAca1764B154221e35c0d20aBb3c525710498`, V4Quoter `0x8dc178ef…8f94`, and the Pons hook.
  - It says the calldata is "Checked byte for byte against `cast abi-encode`" (Foundry).
  - Source: [game/swap.js](https://raidlords.com/game/swap.js)
- **Uniswap v4 on chain 4663:** Uniswap's deployment list for Robinhood Chain includes:
  - PoolManager `0x8366a39cc670b4001a1121b8f6a443a643e40951`. This is the "QFROM" address that RaidLords uses as a funded `from` for quote `eth_call`s, not a RaidLords contract.
  - Universal Router 2.1.2 `0x204FAca1…0498`
  - V4Quoter `0x8dc178ef…8f94`
  - PositionManager `0x58daec31…04fa7`
  - Permit2 `0x000000000022D473030F116dDEE9F6B43aC78BA3`
  - Sources: [Uniswap v4 deployments](https://developers.uniswap.org/llms.mdx/docs/protocols/v4/deployments), [raidlords.com page source](https://raidlords.com/)
- **Vault/claim contract (identified by me, not labelled by the team):** `0x05a3a6c50edb78ba65cb70ccc4b40f7426f0ecdf`. My reads via the [public RPC](https://rpc.mainnet.chain.robinhood.com) found:
  - Runtime code of about 13 KB that contains the `claimed(address)` selector (`0xc884ef83`), the same selector the RaidLords client reads ("what the vault has paid this wallet in total").
  - `token()` returns RAID.
  - It is `Ownable`: `owner()` = `0x4889035cd4daff0e7c1ae486f669a23bc9d8ad2f`, an EOA with no code (so not a Safe multisig), nonce 2.
  - It is pausable: `paused()` = false.
  - The EIP-1967 slot is empty, so it is not a proxy.
  - It holds about 498.6M RAID (≈49.9% of supply).
  - Not verified on Sourcify. — [Sourcify vault (no match)](https://sourcify.dev/server/v2/contract/4663/0x05a3a6c50edb78ba65cb70ccc4b40f7426f0ecdf)
- **Activity** (my `eth_getLogs` over blocks 99,963,979 to 100,024,203, roughly the last few hours before 2026-10-28 ~18:00 UTC; source: [public RPC](https://rpc.mainnet.chain.robinhood.com)):
  - 7,973 RAID Transfer events involving 2,174 unique addresses.
  - The vault sent 2,269 transfers to `0x…dEaD`, which is how burns are executed (transfers to the dead address, not `burn()`).
  - `0x…dEaD` now holds about 66.4M RAID (≈6.6% of supply).
- **Team-reported launch stats:** 4,800+ players, 75,000+ raids, 15.7M tokens burned and 10.5M withdrawn "in the first hours". The developer is "0xOziK, the developer behind Stonewatch". — [eGamers.io, 2026-10-28](https://egamers.io/raidlords-burns-15-7m-tokens-as-4800-players-fight-75000-raids-in-robinhood-chain-debut/) (team claims relayed by the outlet, not independently verified)
- **Explorer:** The game links transactions to `https://robin.etherscan.io` (an Etherscan instance for chain 4663) rather than the Blockscout explorer named in the official docs. — [game/wallet.js](https://raidlords.com/game/wallet.js)

### Inferences
- **On-chain footprint is minimal:** one meme-style ERC-20 made by a launchpad, plus one custom claim vault with cumulative signed vouchers, daily caps, pause and per-wallet holds. Cosmetics, champions and gear are database rows, not NFTs.
- **Upgradeability is "redeploy, not proxy",** and admin power sits with a single EOA. That is fast to ship but carries real key risk. For our game, a Safe multisig owner (Safe 4337 module addresses are published for chain 4663, see Q5) would be a cheap improvement.
- **The ~66M RAID at the dead address versus the team's 15.7M "first hours" figure** fits continued burning over about two days. My log window is partial, so the burn-rate figures are snapshots, not totals.
- **Copycat tokens are a real risk on this chain.** Our token launch should publish the canonical address prominently and get it whitelisted on DexScreener/OpenSea quickly.

### Gaps
- Holder counts, verified-source status on Blockscout/Etherscan, and explorer transaction totals could not be retrieved: both explorers blocked automated access (Cloudflare challenge / HTTP 403). Someone should check them manually in a browser at robinhoodchain.blockscout.com/token/0xD56A6C45941Ee8aae31ce6A30Bd049e0f7489CBD.
- The vault's identity as "RaidClaim" is inferred from the selector match, `token()` = RAID, and burn behaviour. The team has not published the address.
- No RaidLords contracts were found on the testnet. I did not search the testnet explorer, which was not reachable without a browser.

## Q3. Client tech: platform, engine, wallet library, embedded wallets, gasless transactions

### Takeaway
RaidLords is a hand-written vanilla-JavaScript browser game (playable on desktop and mobile web) rendered with HTML5 Canvas 2D. It uses no game engine and no bundler: one roughly 685 KB HTML file plus a few scripts. Wallets connect through injected EIP-1193 providers, or through Reown AppKit (WalletConnect) with the Wagmi adapter when no injected wallet is present. It has no embedded wallets, no social login, and no ERC-4337 or paymaster gas sponsorship. "Gasless" play exists only because in-game spending is an off-chain database balance.

### Cited Findings
- **Scripts:** The homepage loads plain `<script>` tags: `config.js`, `sprites/manifest.js`, `game/i18n.js`, `game/sim.js`, `game/swap.js`, `game/wallet.js` and `game/champ_duel_ui.js`, plus a large inline script.
- **Rendering:** The source calls `getContext('2d')` 14 times and drives the game with `requestAnimationFrame`. No Pixi/Phaser/Three/Babylon/Unity/Godot references were found (the only "three." hit is English text).
- Source for both points: [raidlords.com page source](https://raidlords.com/)
- **Wallet library:** `wallet.js` loads `@reown/appkit-cdn@1.8.24` from jsDelivr and uses `createAppKit` with a `WagmiAdapter`, configured with chain id 4663 and RPC `https://rpc.mainnet.chain.robinhood.com`. AppKit features are set to `email: false, socials: false, swaps: false, onramp: false`.
  - The developer's comment: "phones must connect like farmingseason.io does… WalletConnect through Reown AppKit, the 'All Wallets' sheet (MetaMask, Trust, OKX, Rainbow and 300+ more)".
  - It also builds deep links that open the game inside the MetaMask, Coinbase Wallet, Trust and OKX in-app browsers.
  - Source: [game/wallet.js](https://raidlords.com/game/wallet.js)
- **Sign-in:** The flow is `eth_requestAccounts`, then `wallet_switchEthereumChain` to `0x1237` (falling back to `wallet_addEthereumChain`), then a nonce fetched from `/auth/nonce`, then `personal_sign`, then `/auth/verify`. The session token is stored in localStorage. One comment notes MetaMask refused to show the sign-in message while on another chain ("launch day 2026-10-26"). — [raidlords.com page source](https://raidlords.com/)
- **On-chain transactions** are sent with raw `eth_sendTransaction`. Calldata is hand-encoded: ERC-20 `transfer` for deposits (`0xa9059cbb`), `approve` (`0x095ea7b3`), and vault claims using server-signed `{to, data}`. Prices and receipts are read directly from the public RPC. — [raidlords.com page source](https://raidlords.com/), [game/swap.js](https://raidlords.com/game/swap.js)
- **Mobile and other surfaces:** The Arena uses WASD "(a stick on a phone)". A Telegram bot pushes alerts "even when it is closed". The guide is available in 7 languages (EN, ZH, VI, PT, ID, ES, TR). — [RaidLords guide](https://raidlords.com/guide/)
- **Asset credit:** The page credits a CC-BY 4.0 Sketchfab model ("cute dragon" by shakiller), which suggests some 3D models are pre-rendered to sprites. — [raidlords.com page source](https://raidlords.com/)

### Inferences
- **A small team (apparently a solo developer, 0xOziK) shipped this with Supabase plus vanilla JS plus Canvas 2D.** It shows a play-and-earn game on this chain does not need Unity or an AA stack: wallet sign-in plus an off-chain balance gives "no gas" UX.
- **The trade-off is custody.** Players' deposited tokens sit in a team-controlled vault, and withdrawals depend on server-signed vouchers.
- **For a dragon-breeding game that wants onboarding without wallets,** Robinhood Chain's documented ERC-4337/EIP-7702 support with Alchemy Gas Manager or ZeroDev, plus Privy/Dynamic embedded wallets (see Q5), are the available upgrades over RaidLords' approach.

### Gaps
- The native-app status (iOS/Android) was not confirmed. Only the web client was observed.
- No analytics or error-tracking SDKs were catalogued (the JS was not reviewed exhaustively).

## Q4. Public GitHub repo, open-source code, audits

### Takeaway
RaidLords has no official public repository and no audit. Its client JS is readable (unminified, heavily commented) but not open-source licensed. The only GitHub hit is an empty third-party repo.

### Cited Findings
- A GitHub repository search for "raidlords" returns only `Yuurisan-N1/Raidlords-Bor`, created 2026-10-28 and empty. It has no affiliation with the team. Note that the guide bans bots. — [GitHub API search](https://api.github.com/search/repositories?q=raidlords), [repo](https://github.com/Yuurisan-N1/Raidlords-Bor)
- The guide and site footer link only to raidlords.com and x.com/RaidLords. There is no GitHub, audit or docs-site link. — [RaidLords guide](https://raidlords.com/guide/)
- The client source references internal server files (`server/vault.sql`, `supabase/deploy.sh`, `supabase/deploy_test.sh`, `game/test/swap_check.js`) that are not published. — [raidlords.com page source](https://raidlords.com/), [game/wallet.js](https://raidlords.com/game/wallet.js)
- RAID and the vault are not verified on Sourcify (see Q2), while the Pons launchpad contracts are. — [Sourcify](https://sourcify.dev/server/v2/contract/4663/0xe33e9e479df8802cb0866d5d05258bec4cf62948)
- `config.js` publicly lists every backend RPC name, including `api_admin_*`. A Supabase anon key and a WalletConnect project id are also present. This is normal for Supabase, where security depends on row-level security and server-side role checks. — [config.js](https://raidlords.com/config.js)

### Inferences
- With no audit, an unverified vault and a single-EOA owner, trust rests entirely on the team. A competing game could differentiate on transparency: verified contracts, a multisig, and a published audit.

### Gaps
- No audit report, bug bounty or security disclosure was found in any source.

## Q5. Robinhood Chain developer tooling and ecosystem for game teams

### Takeaway
Robinhood Chain is a permissionless Arbitrum-based L2 (ETH gas, Ethereum blobs for data availability). The docs list:
- Alchemy as the recommended RPC provider, plus seven other providers;
- first-class ERC-4337 and EIP-7702 support (Alchemy Gas Manager and ZeroDev paymasters; Privy and Dynamic embedded wallets);
- Chainlink Data Feeds, Data Streams and CCIP, but not VRF;
- Goldsky subgraphs for indexing;
- OpenSea for NFTs;
- several bridges.

For on-chain randomness (relevant to breeding), Chainlink VRF v2.5 does not list Robinhood Chain.

### Cited Findings
- **Network basics:**
  - "a permissionless, Ethereum-compatible Layer-2 blockchain" built on Arbitrum. Anyone can deploy.
  - Gas is paid in ETH, and the sequencer orders transactions first-come-first-served.
  - Hardhat, Foundry, ethers.js, viem and Wagmi are named as supported.
  - Support contact: chain-developers-group@robinhood.com.
  - Source: [Robinhood Chain docs](https://docs.robinhood.com/chain)
- **Chain IDs and endpoints:**
  - Mainnet 4663, testnet 46630. Explorers: robinhoodchain.blockscout.com and explorer.testnet.chain.robinhood.com.
  - Data availability uses Ethereum blobs.
  - Public RPCs `https://rpc.mainnet.chain.robinhood.com` and `https://rpc.testnet.chain.robinhood.com` are "rate-limited, not for production".
  - Alchemy is recommended (`https://robinhood-mainnet.g.alchemy.com/v2/{API_KEY}`, with WSS).
  - Other providers: Chainstack, QuickNode, Blockdaemon, dRPC, Validation Cloud, GlobalStake, Pinax.
  - Sequencer feed: `wss://feed.mainnet.chain.robinhood.com`.
  - Source: [Docs: Connecting](https://docs.robinhood.com/chain/connecting)
- **Account abstraction:**
  - ERC-4337 has "first-class support", and EIP-7702 is supported.
  - EntryPoints on 4663: v0.6 `0x5FF137D4…2789`, v0.7 `0x0000000071727De22E5E9d8BAf0edAc6f37da032`, v0.8 `0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108`. The Safe 4337 Module v0.3.0 is also deployed.
  - Paymasters: Alchemy Gas Manager and ZeroDev. SDKs: `@alchemy/wallet-apis` and `@zerodev/sdk`.
  - Privy and Dynamic are named for embedded wallets.
  - Pimlico, Biconomy, Gelato and thirdweb are not mentioned on the page.
  - Source: [Docs: Account Abstraction](https://docs.robinhood.com/chain/account-abstraction)
- **Oracles:**
  - The docs name only Chainlink ("Robinhood Chain uses Chainlink for onchain price data"): Data Feeds for crypto and stock tokens (stock feeds update 24/5) and an L2 Sequencer Uptime Feed. — [Docs: Oracles](https://docs.robinhood.com/chain/oracles-and-price-feeds)
  - Chainlink changelogs confirm Data Feeds and CCIP on mainnet. — [Chainlink Data Feeds changelog](https://dev.chain.link/changelog/data-feeds-expands-to-robinhood-chain-mainnet), [Chainlink CCIP changelog](https://dev.chain.link/changelog/ccip-expands-to-robinhood-chain-mainnet)
- **VRF:** The Chainlink VRF v2.5 supported-networks page does not list Robinhood Chain mainnet or testnet. It lists Arbitrum One, Arbitrum Sepolia, Base, OP and Soneium. — [Chainlink VRF v2.5 supported networks](https://docs.chain.link/vrf/v2-5/supported-networks)
- **Bridges:**
  - Arbitrum canonical bridge (about 10-minute deposits, about 7-day withdrawals): [portal.arbitrum.io](https://portal.arbitrum.io/bridge?destinationChain=robinhood-chain&sourceChain=ethereum)
  - LayerZero/Stargate (OFTs such as WBTC and USDG)
  - Chainlink CCIP via Transporter
  - Relay and Across (seconds)
  - LI.FI and 0x
  - No testnet faucet is listed.
  - Source: [Docs: Bridging](https://docs.robinhood.com/chain/bridging)
- **Gas:** The docs describe the L2 execution fee as "typically very low and stable", plus an L1 data fee proportional to calldata. No numbers are given. — [Docs: Gas & Fees](https://docs.robinhood.com/chain/gas-and-fees)
- **Indexing:** Goldsky supports mainnet and testnet across Subgraphs (The Graph-compatible), Turbo Pipelines, Edge RPC and Compose. Uniswap, Privy, Rainbow and LI.FI pull Robinhood Chain data through Goldsky. — [Goldsky blog](https://goldsky.com/blog/robinhood-chain-data-live-on-goldsky)
- **Other listed partners:** Zerion (wallet data), CoinGecko, LayerZero, Fireblocks, BitGo, Uniswap, Rialto, Morpho, Lighter, Arcus, Paxos USDG, TRM Labs, Entropy Advisors and Allium. — [Robinhood Chain docs](https://docs.robinhood.com/chain)
- **NFT marketplaces:**
  - OpenSea added Robinhood Chain on 2026-07-11 for NFT trading, token swaps and 90+ Stock Tokens, including on mobile. — [OpenSea blog](https://opensea.io/blog/articles/robinhood-chain-is-live-on-opensea)
  - HOODIES Marketplace calls itself the first native NFT marketplace (self-promotional). — [robinhoodnfts.com](https://www.robinhoodnfts.com/)
- **Funding programs:**
  - Robinhood committed $1M to Arbitrum Open House builder programs. — [Arbitrum blog](https://blog.arbitrum.io/robinhood-chain-testnet/)
  - Founder House Singapore offers $300K in prizes and grants, including a Robinhood Chain Founder-in-Residence award; projects must deploy on Robinhood Chain to qualify. — [Coin-Turk](https://en.coin-turk.com/arbitrum-and-robinhood-chain-launch-300000-grant-program-for-founders-in-singapore/) (third-party)
  - Alchemy runs a Robinhood Chain startup program (credits plus $5K AWS). — [Alchemy](https://www.alchemy.com/startup-program/robinhood-chain)
  - I found no dedicated gaming grant.
- **Mainnet launch date:** Third-party sources date the public mainnet to 2026-07-01. — [PlayToEarn](https://playtoearn.com/news/robinhood-chain-has-real-games-here-are-the-top-5-october-2026), [Crypto Briefing](https://cryptobriefing.com/robinhood-chain-hollowfall-play2earn-ore-token/) (third-party; not confirmed on the official docs pages I read)

### Inferences
- **On-chain randomness.** With no VRF, breeding RNG must be server-side (as RaidLords does for everything) or use commit-reveal or blockhash-based schemes. The FCFS sequencer reduces, but does not remove, manipulation incentives for blockhash-based randomness. An off-chain RNG with published seeds or commitments is the pragmatic route.
- **Gasless onboarding.** The cleanest documented stack for wallet-light onboarding is Alchemy (RPC, bundler and Gas Manager) or ZeroDev, with Privy or Dynamic embedded wallets, using EntryPoint v0.7/0.8.
- **Dragon NFTs.** Goldsky subgraphs can index dragon NFTs, and OpenSea already supports the chain for secondary trading.

### Gaps
- **Tooling support not confirmed on chain 4663:** thirdweb, Gelato, Biconomy and Pimlico support was not found in official sources, and The Graph's own network support was not confirmed (only Goldsky's compatibility).
- **Pyth/RedStone and VRF alternatives** (e.g., Gelato VRF, Pyth Entropy) were not checked.
- **Regional and terms-of-service restrictions** (e.g., Stock Token availability by region) were not reviewed. The docs have a [Terms of Service](https://docs.robinhood.com/chain/terms-of-service) page I did not read.
- **Exact gas costs and block time are not in the docs.** My RPC observations suggest about 1.5M blocks in about 50 hours (≈0.12 s blocks). That is an inference, not a documented figure.
- **A third-party headline references an "end of free gas"** ([CryptoTicker](https://cryptoticker.io/en/robinhood-chain-ecosystem-end-of-free-gas/)). I did not verify it.

## Q6. Notable other games and dApps on Robinhood Chain (2026)

### Takeaway
The game scene on Robinhood Chain is young and browser-first, mostly small teams pairing a launchpad-style ERC-20 with burn sinks. Notable titles include:
- Stonewatch (same developer as RaidLords)
- Play Kindra
- Farm Valley
- Hood Siege
- Computers RH
- Hollowfall
- Gigaverse Online and Yield Fields
- Robhood

NFT activity centres on OpenSea and collections such as Spritehood and StonkBrokers.

### Cited Findings
- **PlayToEarn's top 5 (2026-10-07):**
  - Play Kindra: cozy 3D skilling MMO in the browser, KINDRA token from player trades only.
  - Stonewatch: medieval pixel-art strategy, SW token, fixed 1B supply, spent coins burned on chain.
  - Farm Valley: pixel farming, email or EVM-wallet sign-in, NFTs planned.
  - Hood Siege: idle wave-defender from the Sol Siege studio, SIEGE token, 1,455 players on day one.
  - Computers RH: PC-building sim by solo developer 0xArtix, 3,333-NFT free mint planned.
  - Source: [PlayToEarn](https://playtoearn.com/news/robinhood-chain-has-real-games-here-are-the-top-5-october-2026)
- RaidLords is by 0xOziK, "the developer behind Stonewatch". RaidLords' own code calls its vault "the Stonewatch system". — [eGamers.io](https://egamers.io/raidlords-burns-15-7m-tokens-as-4800-players-fight-75000-raids-in-robinhood-chain-debut/), [raidlords.com page source](https://raidlords.com/)
- Hollowfall, a pixel-art extraction game with the $ORE token, is reported as the chain's first Play2Earn game. — [Crypto Briefing](https://cryptobriefing.com/robinhood-chain-hollowfall-play2earn-ore-token/) (headline only; not fetched)
- Gigaverse Online and Yield Fields have confirmed launches on Robinhood Chain. — [eGamers.io](https://egamers.io/robinhood-chain-draws-game-studios-as-gigaverse-online-and-yield-fields-confirm-launches/)
- Robhood is listed on DefiLlama as an on-chain heist/crime protocol on Robinhood Chain. — [DefiLlama](https://defillama.com/protocol/robhood)
- **NFT activity (third-party figures):**
  - About $21.5M in NFT volume in September 2026, second to Ethereum on DefiLlama.
  - Spritehood sold out 44,444 NFTs in about 53 minutes.
  - StonkBrokers NFTs use ERC-6551 token-bound accounts that hold Stock Tokens.
  - Sources: [CryptoTicker on StonkBrokers](https://cryptoticker.io/en/robinhood-chain-nfts-stonkbrokers-erc-6551/), [WEEX](https://www.weex.com/news/detail/the-return-of-nft-summer-which-projects-on-robinhood-chain-deserve-attention-qg7rc7uy4sz2zsm2nfhe4cub) (third-party; figures not verified)
- **Small open-source game repos targeting the chain:** `1lxthvl/hoodatm`, `launchers222/stonkminer`, `Rydhlnst/barrel-royale` and `IceBox247/DRIP` (an ORE-style mining game). — [GitHub search](https://api.github.com/search/repositories?q=robinhood+chain+game)

### Inferences
- **The dominant template:** web client, off-chain game server, a fixed-supply ERC-20 (often from Pons), burn-on-spend sinks, and a dollar-pegged earn cap.
- **The opening for us:** a dragon-breeding game whose core assets are NFTs (ERC-721 dragons, possibly ERC-6551 so dragons can hold items) would stand apart from these mostly token-only games.

### Gaps
- No verified player counts or on-chain usage were found for most of these games beyond team claims relayed by outlets.
- No dragon-breeding or creature-breeding game on Robinhood Chain was found in these sources.
