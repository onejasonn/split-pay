import { client } from "./lib/stellar";

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
