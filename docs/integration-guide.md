# Integration guide

## Marketplace checkout

A marketplace that takes a 5% fee registers one split per seller:

```text
create_split(owner = marketplace, recipients = [
  { address: seller,      share_bps: 9500 },
  { address: marketplace, share_bps:  500 },
])
```

At checkout the buyer signs `pay(split_id, buyer, USDC_SAC, price)`: the
seller and the marketplace are paid in the same transaction. No nightly
payout job is needed.

## Royalty agreements

For a published royalty agreement, create the split and then call
`lock_split`. Anyone can verify on-chain that the recipients can never be
changed, which is a stronger guarantee than a PDF contract.

## Previewing amounts in a UI

Call `preview(split_id, amount)` (a read-only simulation) to show each
recipient's exact share, including where the rounding dust goes, before
the payer signs.

## Handing control to a team

`transfer_ownership(split_id, multisig_address)` moves control to a
multisig such as [Quorum Vault](https://github.com/oluwarantimini/quorum-vault),
so no single key can change who gets paid.
