# Robinhood Chain — developer reference

> Gathered 2026-10-28 from third-party guides. **Verify every value against the official docs (docs.robinhood.com/chain) before use** — RPCs, faucets and explorers change, and fake explorers exist.

## What it is
- Ethereum Layer 2 built on **Arbitrum Orbit** (Nitro stack). EVM-equivalent: Solidity, Foundry, Hardhat, viem, wagmi, ethers all work unchanged.
- Gas token: **ETH** (bridged from Ethereum).
- Testnet launched 2026-02-10; mainnet launched 2026-07-01 (per third-party sources).

## Networks
| | Mainnet | Testnet |
|---|---|---|
| Chain ID | 4663 (0x1237) | 46630 (0xb626) |
| Public RPC | https://rpc.mainnet.chain.robinhood.com | https://rpc.testnet.chain.robinhood.com |
| Explorer | https://robinhoodchain.blockscout.com | https://explorer.testnet.chain.robinhood.com |
| Gas | ETH | testnet ETH (faucet) |

- Public RPCs are shared and rate-limited: fine for development, use a dedicated provider (e.g. Alchemy, QuickNode) for the production server.
- Faucets: reported at faucet.testnet.chain.robinhood.com and an Alchemy faucet; limits undocumented.
- Unofficial look-alike explorers reported (hoodexplorer.org, robinhoodchain.wiki, "robinscan") — do not trust them.

## Tooling available (from docs.robinhood.com/chain, Oct 2026)
- RPC providers: Alchemy (recommended), QuickNode, Chainstack, Blockdaemon, dRPC.
- Account abstraction: ERC-4337 (EntryPoint v0.6/0.7/0.8) and EIP-7702; gas sponsorship via Alchemy Gas Manager or ZeroDev; embedded wallets via Privy or Dynamic.
- Oracles: Chainlink price feeds, Data Streams, CCIP. **No Chainlink VRF** → randomness stays server-side with commit-reveal.
- Indexing: Goldsky subgraphs (mainnet + testnet).
- DEX: Uniswap v4 deployed (RaidLords prices off the v4 PoolManager). OpenSea live since 2026-07-11.
- Bridges: canonical Arbitrum bridge, Stargate/LayerZero, Chainlink CCIP (Transporter), Relay, Across, LI.FI, 0x.
- Other games on the chain: RaidLords, Stonewatch, Farm Valley, Hood Siege, Gigaverse Online and others; no dragon/creature-breeding game found.

## Arbitrum-specific gotchas (apply to Orbit chains)
- `block.number` returns an **approximate L1 block number**, not the L2 block. Use `block.timestamp` for time, or ArbSys `arbBlockNumber()` if you need the L2 block.
- Never use `blockhash`/`block.prevrandao` for randomness — the sequencer controls ordering. Game RNG stays server-side (commit-reveal or VRF if it ever must be on-chain).
- Gas = L2 execution + L1 data cost; batch writes and keep calldata small.
- Sequencer gives soft finality in ~seconds; treat value transfers as final only after L1 batch posting when it matters.

## Config snippets
viem chain definition:
```ts
import { defineChain } from 'viem'
export const robinhoodTestnet = defineChain({
  id: 46630,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'Explorer', url: 'https://explorer.testnet.chain.robinhood.com' } },
  testnet: true,
})
```
foundry.toml:
```toml
[rpc_endpoints]
rh_testnet = "${RH_TESTNET_RPC}"
rh_mainnet = "${RH_MAINNET_RPC}"
```
Deploy: `forge script script/Deploy.s.sol --rpc-url rh_testnet --broadcast` (key via `--account` keystore, never a plaintext key in `.env` committed to git).

## Deployed addresses (testnet 46630)

Deployed with `contracts/script/Deploy.s.sol` (see `contracts/README.md`). **TBD until the first testnet deployment.**

| Contract | Address | Verified |
|---|---|---|
| DrisToken | TBD | |
| DrisVault | TBD | |
| Team VestingWallet | TBD | |
| Owner Safe | TBD | |

Only addresses listed here (and later on the official site) are genuine; copycat tokens are common on this chain.

## Official docs to bookmark (add as project links)
- Robinhood Chain docs: docs.robinhood.com/chain
- Arbitrum developer docs: docs.arbitrum.io (Orbit differences, ArbSys, gas)
- OpenZeppelin Contracts v5: docs.openzeppelin.com/contracts/5.x
- Foundry book: book.getfoundry.sh
- viem / wagmi: viem.sh, wagmi.sh

## Sources
- https://trustswap.com/robinhood/network-details
- https://trustswap.com/robinhood/testnet
- https://triport.io/learn/robinhood-chain-testnet
- https://www.quicknode.com/builders-guide/tools/robinhood-chain-public-rpc-by-robinhood-markets
- https://www.archliquid.com/blog/robinhood-chain-network-configuration
