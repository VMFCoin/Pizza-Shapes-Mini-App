# Pizza Dots Payment & Fee Distribution System

## Overview

This document describes the complete payment flow for the Pizza Dots Mini App, including wallet connection, entry fee payments, prize distribution, and fund management.

## Fee Distribution Breakdown

Every entry fee is distributed as follows:

| Recipient | Percentage | Description |
|-----------|------------|-------------|
| **Match Winner** | 77% | Paid directly to winner's wallet |
| **Weekly Top 3** | 10% | Accumulated in vault for weekly leaderboard payouts |
| **Token Burn** | 7% | Sent to 0xdead, permanently removed from circulation |
| **Daily Free Roll** | 3% | Prize pool for daily free roll winners |
| **Veteran Charities** | 3% | Split equally among 9 veteran charities |

## Entry Tiers

| Tier | Entry Fee | Grid Size | Max Players |
|------|-----------|-----------|-------------|
| 1 | 0.25 $PIZZA | 4x4 | 2 |
| 2 | 0.50 $PIZZA | 6x6 | 4 |
| 3 | 1.00 $PIZZA | 8x8 | 6 |

## Charity Wallets

The 3% charity allocation is split equally among these 9 veteran charities:

1. **Patriots Promise** - `0x6456879a5073038b0E57ea8E498Cb0240e949fC3`
2. **Victory For Veterans** - `0x700B53ff9a58Ee257F9A2EFda3a373D391028007`
3. **Holy Family Village** - `0xB697C8b4bCaE454d9dee1E83f73327D7a63600a1`
4. **Camp Cowboy** - `0x5951A4160F73b8798D68e7177dF8af6a7902e725`
5. **Veterans In Need Project** - `0xfB0EF51792c36Ae1fE6636603be199788819b67D`
6. **Honor HER Foundation** - `0x10F01632DC709F7fA413A140739D8843b06235A1`
7. **Magicians On Mission** - `0x0730d4dc43cf10A3Cd986FEE17f30cB0E75410e0`
8. **April Forces** - `0x043820c97771c570d830bb0e189778fdef5e6eeb`
9. **Little Patriots Embraced** - `0x097701F99CC7b0Ff816C2355faC104ADdC6e27B9`

Each charity receives approximately 0.33% of every entry fee (3% ÷ 9).

## Smart Contracts

### PizzaShapesSettlementV2.sol
Main contract handling entry fees and prize distribution.

**Key Functions:**
- `enterMatch(bytes32 matchId, uint8 tier)` - Player enters with entry fee
- `settleMatch(...)` - Operator settles completed match
- `distributeWeeklyTop3(...)` - Distribute weekly leaderboard rewards
- `payFreeRollWinner(...)` - Pay daily free roll winner

### WeeklyVault.sol
Holds 10% allocation for weekly top 3 leaderboard.

**Distribution:**
- 1st Place: 50% of pool
- 2nd Place: 30% of pool
- 3rd Place: 20% of pool

### FreeRollVault.sol
Holds 3% allocation for daily free roll prizes.

**Mechanics:**
- One roll per Farcaster FID per UTC day
- Pick a number 1-6
- If it matches the VRF result, win 1/6 of daily pool
- Unclaimed pool rolls over to weekly vault at midnight

## Payment Flow

### 1. Wallet Connection
```
User opens app → Farcaster Mini App wallet auto-connects → Fetch $PIZZA balance
```

### 2. Match Entry
```
1. User selects tier
2. Check $PIZZA balance ≥ entry fee
3. Check/request token approval for settlement contract
4. Call enterMatch() on settlement contract
5. Entry fee transferred to contract
6. Player added to match
```

### 3. Match Settlement (on game completion)
```
1. Backend determines winner
2. Calls settleMatch() on contract
3. Contract distributes:
   - 77% → Winner's wallet
   - 10% → Weekly vault
   - 7% → Burn address (0xdead)
   - 3% → Free roll vault
   - 3% → 9 charity wallets (split evenly)
4. Stats recorded on-chain
5. Database updated
```

### 4. Weekly Distribution (Sunday UTC midnight)
```
1. Cron job triggers distribute-weekly function
2. Fetch top 3 players from stats contract
3. Distribute weekly vault: 50%/30%/20%
4. Reset weekly slices counter
```

### 5. Daily Free Roll
```
1. User picks number 1-6
2. Backend generates VRF result
3. If match: user wins 1/6 of daily pool
4. Prize transferred to user's wallet
```

## Frontend Hooks

### useWallet
Handles wallet connection, balance, and transactions.

```typescript
const {
  address,
  balance,
  connect,
  approvePizza,
  enterMatch
} = useWallet();
```

### usePayment
Manages the complete payment flow with status tracking.

```typescript
const {
  paymentState,
  enterMatchWithPayment,
  calculatePrizeBreakdown
} = usePayment();
```

### useSettlement
Provides settlement preview and on-chain data fetching.

```typescript
const {
  getSettlementPreview,
  fetchPoolBalances,
  formatPrize
} = useSettlement();
```

## Supabase Edge Functions

| Function | Purpose | Trigger |
|----------|---------|---------|
| `settle-match` | Settle completed match on-chain | Game completion |
| `process-free-roll` | Process daily free roll | User action |
| `distribute-weekly` | Distribute weekly rewards | Cron (Sunday midnight) |

## Environment Variables

### Frontend (Next.js)
```env
NEXT_PUBLIC_SETTLEMENT_CONTRACT=0x...
NEXT_PUBLIC_STATS_CONTRACT=0x...
NEXT_PUBLIC_WEEKLY_VAULT_CONTRACT=0x...
NEXT_PUBLIC_FREE_ROLL_CONTRACT=0x...
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
```

### Edge Functions (Supabase Secrets)
```env
OPERATOR_PRIVATE_KEY=0x...  # KEEP SECRET!
SETTLEMENT_CONTRACT_ADDRESS=0x...
BASE_RPC_URL=https://mainnet.base.org
```

## Token Burn Mechanism

7% of every entry fee is sent to the burn address:
```
0x000000000000000000000000000000000000dEaD
```

Tokens sent to this address are permanently removed from circulation as no one controls the private key for this address. This creates deflationary pressure on $PIZZA.

## Security Considerations

1. **Operator Role** - Only authorized operator can call `settleMatch()`
2. **UUPS Upgradeable** - Contracts can be upgraded by admin if bugs found
3. **Pausable** - Admin can pause contracts in emergency
4. **No Reentrancy** - Transfers happen before state updates
5. **Input Validation** - All inputs validated on-chain

## Deployment Checklist

1. [ ] Deploy PizzaShapesStats contract
2. [ ] Deploy WeeklyVault contract
3. [ ] Deploy FreeRollVault contract
4. [ ] Deploy PizzaShapesSettlementV2 with all addresses
5. [ ] Grant OPERATOR_ROLE to backend wallet
6. [ ] Verify all contracts on BaseScan
7. [ ] Update environment variables
8. [ ] Run Supabase migrations
9. [ ] Deploy Edge Functions
10. [ ] Test full payment flow on testnet first
