import { xdr } from "@stellar/stellar-sdk";
import { addr, u32 } from "./lib/stellar";
import type { Recipient } from "./config";

/** Vec<Recipient> as Soroban expects it: a vec of maps with keys sorted alphabetically. */
export function recipientsScVal(rows: Recipient[]): xdr.ScVal {
  return xdr.ScVal.scvVec(
    rows.map((r) =>
      xdr.ScVal.scvMap([
        new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("address"), val: addr(r.address) }),
        new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("share_bps"), val: u32(r.share_bps) }),
      ]),
    ),
  );
}
