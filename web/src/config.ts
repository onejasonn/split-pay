import { client, u64 } from "./lib/stellar";

export const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID ?? "CD7WP6AMDTM4SZLH66NONULCOQ5GJ3XGEGZ3YBEHIZCK3M6YDOP5XYQW";

export const ERRORS: Record<number, string> = {
  1: "No split with that id.",
  2: "Only the split's owner can do that.",
  3: "Shares must add up to exactly 100% and none can be 0%.",
  4: "Add at least one recipient.",
  5: "A split can have at most 20 recipients.",
  6: "Each recipient can appear only once.",
  7: "Enter an amount greater than zero.",
  8: "This split is locked and can't be changed.",
};

export const splitPay = client(CONTRACT_ID, ERRORS);

export interface Recipient {
  address: string;
  share_bps: number;
}
export interface Split {
  id: bigint;
  owner: string;
  recipients: Recipient[];
  locked: boolean;
}

export const PALETTE = ["#3d1747", "#e8674a", "#d9a441", "#6b3a75", "#2f7d6d", "#b3436b", "#8a6f3e", "#4f6bb0"];

/** Every split, newest first: split_count plus parallel batches of get_split. */
export async function allSplits(batch = 10): Promise<Split[]> {
  const count = Number(await splitPay.read<bigint>("split_count"));
  const out: Split[] = [];
  for (let start = 1; start <= count; start += batch) {
    const ids = Array.from({ length: Math.min(batch, count - start + 1) }, (_, i) => BigInt(start + i));
    const got = await Promise.allSettled(ids.map((id) => splitPay.read<Split>("get_split", [u64(id)])));
    for (const r of got) if (r.status === "fulfilled") out.push(r.value);
  }
  return out.reverse();
}

/**
 * The pending owner of a split, or undefined when the deployed contract
 * predates two-step ownership (then only the one-step transfer exists).
 */
export async function pendingOwner(id: bigint): Promise<string | null | undefined> {
  try {
    return (await splitPay.read<string | null>("pending_owner", [u64(id)])) ?? null;
  } catch {
    return undefined;
  }
}