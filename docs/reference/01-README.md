# Wyrmhaven project setup

1. Extract `wyrmhaven.zip` into a new, empty folder and open that folder as the project in Claude Code. `CLAUDE.md` at the root loads automatically in every session.
2. **Instructions:** paste the text between the `---` lines of `PROJECT_INSTRUCTIONS.md`.
3. **Files / Knowledge:** upload the list below. If the project is only the folder opened in Claude Code, you can skip this: the files are already in the folder and `CLAUDE.md` points to them.
4. **First message:** the text between the `---` lines of `STARTING_PROMPT.md`.

## Files to upload

1. `docs/superpowers/specs/2026-10-28-wyrmhaven-design.md` — game design spec (source of truth)
2. `reports/Dragon breeding genre and RaidLords.md` — research: genre mechanics, RaidLords build, spec implications
3. `docs/reference/02-robinhood-chain.md` — chain IDs, RPCs, Arbitrum gotchas
4. `docs/reference/03-economy-and-earn.md` — one-screen economy overview
5. `docs/reference/04-architecture.md` — system diagram and responsibilities
6. `docs/superpowers/plans/2026-10-28-game-core-economy.md` — current implementation plan (Phase 1)
7. `CLAUDE.md` — coding rules (same rules Claude Code follows)

Optional external docs to save as PDF (browser → Print → Save as PDF) and upload:
- docs.robinhood.com/chain: getting started, network info, account abstraction, tooling partners
- Arbitrum docs: "Solidity support / differences from Ethereum" and "Gas and fees"
- OpenZeppelin v5: ERC-20, EIP-712, SafeERC20, Pausable
- Uniswap v4: oracle/TWAP guidance

Keep the uploaded files small and current: when a spec or plan changes, re-upload it and delete the old copy.
