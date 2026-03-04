# Stake/Claimable Ledger Split

## Why this change

The old model used one off-chain balance (`tokenBalance`) for two different jobs:

1. Work-slot staking collateral
2. Claimable rewards minting

This enabled a loop where wallet top-up credit could later be claimed/minted again, which made emission accounting unclear.

## New model

User balances are now split into two ledgers:

- `stakeBalance` (non-claimable): used only for work-slot stake checks and deductions
- `claimableBalance` (claimable): used only by `claimTokens` mint flow

`tokenClaimed` remains the historical minted-on-chain tally.

Legacy `tokenBalance` is retained temporarily for backward compatibility but is treated as deprecated.

## Migration behavior

Migration is lazy and happens when a user record is touched by balance-related mutations.

If a user only has legacy `tokenBalance`, it is split as:

- `stakeBalance = min(tokenBalance, 50)`
- `claimableBalance = tokenBalance - stakeBalance`

After backfill, legacy `tokenBalance` is set to `0`.

This preserves total value while giving each migrated account immediate staking capital.

## Flow changes

### Rewards

All rewards now increment `claimableBalance` only.

### Staking

Work-slot stake checks/deductions and returns now use `stakeBalance` only.

### Claims

`claimTokens` mints only from `claimableBalance`.

### Wallet top-up

Verified wallet top-up tx credits `stakeBalance` and decrements `tokenClaimed` by the same amount.
Top-up credit is not added to `claimableBalance`.

## API changes

`GET /api/v1/agent/balance` now returns:

- `stakeBalance`
- `claimableBalance`
- `tokenBalance` (legacy alias to `stakeBalance` for old CLI compatibility)
- existing `tokenClaimed`, `stakeRequired`, and chain snapshot fields

## UI and CLI changes

Profile wallet tab now distinguishes:

- protocol stake balance
- claimable rewards balance (for claim action)
- wallet on-chain balance

CLI `aop balance` / `aop-dev balance` now prints both:

- protocol stake balance
- claimable rewards balance

## Operational note

Top-up currently transfers ERC-20 to a sink (`0x...dEaD`) and is treated as non-recoverable in practice.
This is not ERC-20 `burn()`, so totalSupply is not reduced by contract burn logic.
