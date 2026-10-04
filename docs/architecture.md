# Architecture

## Data model

```text
Split { id, owner, recipients: Vec<Recipient { address, share_bps }>, locked }
DataKey::NextId          (instance)    → last issued split id
DataKey::Split(id)       (persistent)  → Split
```

Shares are basis points and must sum to exactly `10_000`. A split holds at
most 20 recipients so a single `pay` stays well within Soroban's
per-transaction resource limits.

## Payment flow

```text
payer ──pay(split_id, token, amount)──▶ contract
                                        │ payout_amounts(): floor(amount × bps / 10_000) each
                                        │ dust = amount − Σ shares → recipient[0]
                                        ├─ token.transfer(payer → recipient[0], share₀ + dust)
                                        ├─ token.transfer(payer → recipient[1], share₁)
                                        └─ …
```

Transfers go **directly from the payer**; the contract is never the token
holder. That removes a whole class of bugs (stuck balances, withdrawal
accounting, reentrancy into a pooled balance) and means there's nothing to
drain.

## Invariants

1. `Σ share_bps == 10_000` for every stored split.
2. `Σ payouts == amount` for every `pay` (dust goes to recipient 0).
3. A locked split's recipients never change again.
4. Only the owner can update, lock or transfer a split.

## Storage lifetime

Every write and every `pay` extends the split's TTL (threshold 30 days, extend
to 120 days), so actively used splits are never archived.
