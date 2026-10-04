# Split Pay

**One payment in, many payouts out — on Stellar.**

Split Pay is a Soroban smart contract for revenue sharing. Register a
*split* once (who gets paid, and what percentage each gets), then anyone
can pay into it in any Stellar asset. Every recipient is paid their share
in the same transaction, straight from the payer's wallet.

Use it for:

- **Music and media royalties**: artist 60%, producer 25%, label 15%.
- **Marketplace fees**: seller 95%, platform 5%, paid out instantly.
- **Team and DAO revenue**: contributors paid the moment money comes in.
- **Affiliate and referral payouts** that need no monthly reconciliation.

## Why it's safe

- **No custody.** The contract never holds a balance. Each `pay` transfers
  directly from the payer to the recipients, so there is nothing to
  withdraw, forget or drain.
- **Nothing is lost to rounding.** Shares are rounded down and the leftover
  (at most one smallest-unit per recipient) goes to the first recipient,
  so payouts always add up to exactly the amount paid.
- **Lockable.** Once an owner calls `lock_split`, the recipients can never
  be changed. That's useful when a split represents a signed agreement.
- **Strict validation.** Shares must add up to exactly 100%. Zero shares,
  duplicate recipients and more than 20 recipients are all rejected.

## Contract interface

| Function | Who signs | What it does |
| --- | --- | --- |
| `create_split(owner, recipients)` | owner | Registers a split; returns its id |
| `update_split(split_id, recipients)` | owner | Replaces recipients (only while unlocked) |
| `lock_split(split_id)` | owner | Freezes recipients forever |
| `transfer_ownership(split_id, new_owner)` | owner | Hands control to another address (e.g. a multisig) |
| `pay(split_id, payer, token, amount)` | payer | Pays `amount` of `token` out to every recipient |
| `preview(split_id, amount)` | anyone | Shows how `amount` would be divided, moving nothing |
| `get_split(split_id)` / `split_count()` | anyone | Read state |

`recipients` is a list of `{ address, share_bps }` where `share_bps` is
in basis points: `10000` = 100%, `2500` = 25%.

### Events

| Topics | Data |
| --- | --- |
| `("split", "created")` | split id |
| `("split", "updated")` | split id |
| `("split", "locked")` | split id |
| `("split", "paid", split_id)` | `{ payer, token, amount }` |

### Errors

`SplitNotFound (1)`, `NotOwner (2)`, `InvalidShares (3)`, `NoRecipients (4)`,
`TooManyRecipients (5)`, `DuplicateRecipient (6)`, `InvalidAmount (7)`,
`SplitLocked (8)`.

## Build, test and deploy

Requires Rust and the [Stellar CLI](https://developers.stellar.org/docs/tools/cli).

```bash
cd contracts
cargo test                                   # 13 unit tests
stellar contract build                       # → target/wasm32v1-none/release/split_pay.wasm

stellar keys generate me --network testnet --fund
stellar contract deploy \
  --wasm target/wasm32v1-none/release/split_pay.wasm \
  --source me --network testnet
```

Create a 70/30 split and pay 100 XLM into it:

```bash
stellar contract invoke --id <CONTRACT_ID> --source me --network testnet -- \
  create_split --owner me \
  --recipients '[{"address":"G...ARTIST","share_bps":7000},{"address":"G...PRODUCER","share_bps":3000}]'

stellar contract invoke --id <CONTRACT_ID> --source me --network testnet -- \
  pay --split_id 1 --payer me --token <XLM_SAC_ID> --amount 1000000000
```

## Documentation

- [Architecture](docs/architecture.md)
- [Integration guide](docs/integration-guide.md)
- [Contributing](CONTRIBUTING.md) · [Security policy](SECURITY.md) · [Changelog](CHANGELOG.md)

## Glossary (new to Stellar?)

- **Soroban**: Stellar's smart-contract platform. Contracts are written in
  Rust and compiled to WebAssembly (`.wasm`).
- **Basis points (bps)**: hundredths of a percent. 100 bps = 1%,
  10,000 bps = 100%. Using whole numbers avoids decimal rounding bugs.
- **Stellar Asset Contract (SAC)**: the contract address that represents a
  Stellar asset (including native XLM) inside Soroban. `token` in `pay` is
  a SAC address.
- **Stroop**: the smallest unit of XLM. 1 XLM = 10,000,000 stroops, so
  `amount` is always in the asset's smallest unit.
- **`require_auth`**: how a contract checks that an address actually signed
  the transaction. `pay` requires the payer's signature, and the
  `update`/`lock` functions require the owner's.
- **TTL / archival**: Soroban storage expires unless it's extended. This
  contract extends a split's lifetime every time it's written or paid
  into, so active splits stay live.

## License

MIT
