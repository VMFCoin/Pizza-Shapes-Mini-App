# Pizza Dots Mini App

**Pizza Dots** is a multiplayer, turn-based strategy game built as a **Farcaster Mini App** on **Base mainnet**. Inspired by Dots and Boxes, players draw lines between dots to complete **triangles (pizza slices)** and compete for onchain **$PIZZA** rewards.

- **$PIZZA token (Base)**: `0xa821f2ee19f4f62e404c934d43eb6e5763fbdb07`

## What’s in this repo

- **Frontend**: Next.js App Router (`src/app/*`) + Tailwind + Framer Motion
- **Realtime game + matchmaking**: Supabase Postgres + Realtime (`supabase/migrations/*`, `src/hooks/useRealtime*`)
- **Edge Functions**: Supabase Functions for matchmaking + bot turns + on-chain settlement (`supabase/functions/*`)
- **Smart contracts**: Hardhat + UUPS upgradeable contracts (`contracts/*`, `scripts/*`)

## Gameplay (how it works)

- **Goal**: capture the most pizza slices (triangles).
- **Turn flow**:
  - roll a die → you get that many moves (edges) this turn
  - draw lines between adjacent dots (**horizontal / vertical / diagonal**)
  - completing a triangle captures it and grants an **extra move**
  - if you roll more moves than available edges, your turn is skipped
- **Game ends** when no uncaptured triangles remain.

## Entry tiers

Tiers are displayed as USD labels in the UI; the app converts USD → **PIZZA amount** using live price data at time of entry, then calls the settlement contract.

| Tier | UI label | Grid | Players (min–max) |
|------|----------|------|-------------------|
| 1 | $0.25 | 4×4 | 2–4 |
| 2 | $0.50 | 6×6 | 2–6 |
| 3 | $1.00 | 8×8 | 2–8 |

## Prize distribution (basis points)

Each entry fee is split:

- **77%** → match winner (or split among co-winners for ties)
- **10%** → weekly top 3 vault
- **7%** → burn (`0x000000000000000000000000000000000000dEaD`)
- **3%** → daily free roll vault
- **3%** → 9 veteran charities

More details in `docs/PAYMENT_SYSTEM.md`.

## Local dev

```bash
npm install
npm run dev
```

## Environment variables

This repo reads env vars from `.env.local` / `.env`. **Do not commit secrets** (private keys, service role keys).

### Frontend (Next.js)

See `.env.example` for the full list. At minimum, you’ll typically need:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org

NEXT_PUBLIC_PIZZA_TOKEN=0xa821f2ee19f4f62e404c934d43eb6e5763fbdb07
NEXT_PUBLIC_SETTLEMENT_CONTRACT=0x...
NEXT_PUBLIC_STATS_CONTRACT=0x...
NEXT_PUBLIC_WEEKLY_VAULT_CONTRACT=0x...
NEXT_PUBLIC_FREE_ROLL_CONTRACT=0x...
```

### Supabase Edge Functions (secrets)

Edge Functions use service role + operator key to call on-chain settlement:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

BASE_RPC_URL=https://mainnet.base.org
OPERATOR_PRIVATE_KEY=0x...
SETTLEMENT_CONTRACT_ADDRESS=0x...
```

## Supabase database

- Migrations live in `supabase/migrations/*`.
- Notable migrations:
  - `005_payment_tables.sql`: free rolls + settlement records + weekly distributions
  - `008_concurrency_and_timeout.sql`: optimistic concurrency (`matches.version`) + server-side turn timeout helper (`auto_advance_stale_turns()`)

## Supabase Edge Functions

Functions live in `supabase/functions/*`:

- **`create-match`**: FIFO matchmaking for *ready* queue entries, initializes match + game state
- **`validate-move`**: server-authoritative move validation + optimistic concurrency
- **`add-bot-player`**, **`trigger-bot-turn`**, **`bot-takeover`**: bot flows
- **`process-free-roll`**: daily free roll outcomes/payouts
- **`distribute-weekly`**: weekly top-3 payout
- **`settle-match`**: on-chain settlement (`settleMatch`, `settleBotMatch`, `settleTiedMatch`)

## Smart contracts + Hardhat

Contracts are in `contracts/*` and deployed/upgraded via `scripts/*`.

**Deployed on Base mainnet:**

| Contract | Address |
|----------|---------|
| Settlement (UUPS proxy) | `0xb3E75c6957a0d0131f1F3586937e179590bBF852` |
| Settlement V5 (impl) | `0xb9608720192C3223e6f7c82d2D4a787Cd600ce7e` |
| $PIZZA token | `0xa821f2ee19f4f62e404c934d43eb6e5763fbdb07` |

Common commands:

```bash
npm run compile
npm run deploy
```

Upgrades:

- `scripts/upgrade-v4.ts`: adds bot-aware settlement path (`settleBotMatch`)
- `scripts/upgrade-v5.js`: adds tied-match settlement path (`settleTiedMatch`)

## Tester refunds (old contract)

If testers paid into an old settlement contract, you can **withdraw the ERC20 balance via `emergencyWithdraw`** (admin-only) and refund them.

Dry run:

```bash
npm run refund
```

Execute:

```bash
npm run refund:confirm
```

If the funds are on a *different* contract than your current `NEXT_PUBLIC_SETTLEMENT_CONTRACT`, set:

```bash
OLD_CONTRACT_ADDRESS=0xOLD_CONTRACT npm run refund:confirm
```

Helpful diagnostics:

```bash
npm run scan-balances
node scripts/check-deposits.js
```

## Project structure

```
src/                 Next.js app (pages/components/hooks)
contracts/           Solidity contracts (UUPS)
scripts/             Hardhat deploy/upgrade/refund utilities
supabase/
  migrations/        Postgres schema + policies
  functions/         Supabase Edge Functions (Deno)
docs/                On-chain payment system notes
```
