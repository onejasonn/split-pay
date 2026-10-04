import { useState } from "react";
import { StrKey } from "@stellar/stellar-sdk";
import { CONTRACT_ID, PALETTE, splitPay, type Recipient, type Split } from "./config";
import { Donut } from "./components/Donut";
import { recipientsScVal } from "./scval";
import { addr, contractLink, i128, txLink, u64, XLM_SAC } from "./lib/stellar";
import { fromUnits, short, toUnits } from "./lib/format";
import { useWallet } from "./lib/useWallet";
import { useAction } from "./lib/useAction";

type Tab = "pay" | "create" | "manage";

export default function App() {
  const wallet = useWallet();
  const [tab, setTab] = useState<Tab>("pay");

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <span className="font-display text-xl font-bold text-plum">Split Pay</span>
          <span className="ml-2 rounded-full bg-plum/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-plum">
            testnet
          </span>
        </div>
        <WalletButton {...wallet} />
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-10 pt-6 md:pt-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Revenue sharing on Stellar</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold leading-[1.05] text-plum md:text-6xl">
          One payment in. <span className="italic text-coral">Everyone</span> paid out.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-ink/75">
          Register who gets what once (artist, producer, label, platform) and every payment into the split fans out
          to each of them in the same transaction. No custody, no payout runs, no spreadsheets.
        </p>
      </section>

      <nav className="mx-auto flex max-w-6xl gap-2 px-5">
        {(
          [
            ["pay", "Pay into a split"],
            ["create", "Create a split"],
            ["manage", "Manage"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`btn ${tab === id ? "btn-primary" : "btn-ghost text-plum hover:bg-white"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="mx-auto max-w-6xl px-5 py-8">
        {tab === "pay" && <PayPanel wallet={wallet} />}
        {tab === "create" && <CreatePanel wallet={wallet} onCreated={() => setTab("manage")} />}
        {tab === "manage" && <ManagePanel wallet={wallet} />}
      </main>

      <section className="mx-auto grid max-w-6xl gap-5 px-5 pb-16 md:grid-cols-3">
        {[
          ["No custody", "Every payout goes straight from the payer to each recipient. The contract never holds a balance."],
          ["Nothing lost to rounding", "Shares round down; the leftover goes to the first recipient, so payouts always add up."],
          ["Lock it forever", "Freeze a split's recipients so collaborators can verify on-chain the deal can't change."],
        ].map(([t, d]) => (
          <div key={t} className="card p-6">
            <h3 className="font-display text-lg font-bold text-plum">{t}</h3>
            <p className="mt-2 text-sm text-ink/70">{d}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-line py-8 text-center text-xs text-ink/60">
        Contract{" "}
        <a className="font-mono underline" href={contractLink(CONTRACT_ID)} target="_blank" rel="noreferrer">
          {short(CONTRACT_ID, 6)}
        </a>{" "}
        on Stellar testnet ·{" "}
        <a className="underline" href="https://github.com/onejasonn/split-pay" target="_blank" rel="noreferrer">
          Source on GitHub
        </a>
      </footer>
    </div>
  );
}

type Wallet = ReturnType<typeof useWallet>;

function WalletButton({ address, connect, connecting, error }: Wallet) {
  return (
    <div className="text-right">
      {address ? (
        <span className="rounded-full border border-line bg-paper px-4 py-2 font-mono text-sm text-plum">{short(address)}</span>
      ) : (
        <button className="btn btn-primary" onClick={connect} disabled={connecting}>
          {connecting ? "Connecting…" : "Connect Freighter"}
        </button>
      )}
      {error && <p className="mt-1 max-w-xs text-xs text-coral">{error}</p>}
    </div>
  );
}

function Status({ action }: { action: ReturnType<typeof useAction> }) {
  if (action.error) return <p className="rounded-xl bg-coral/10 px-4 py-3 text-sm text-coral">{action.error}</p>;
  if (action.notice)
    return (
      <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        {action.notice.text}{" "}
        {action.notice.hash && (
          <a className="underline" href={txLink(action.notice.hash)} target="_blank" rel="noreferrer">
            View transaction
          </a>
        )}
      </p>
    );
  return null;
}

function RecipientList({ split, preview }: { split: Split; preview?: bigint[] }) {
  return (
    <ul className="space-y-2">
      {split.recipients.map((r, i) => (
        <li key={r.address} className="flex items-center justify-between gap-3 rounded-xl bg-cream/60 px-3 py-2">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="font-mono text-sm">{short(r.address, 6)}</span>
          </span>
          <span className="text-sm">
            <b>{(r.share_bps / 100).toFixed(2).replace(/\.00$/, "")}%</b>
            {preview && <span className="ml-3 text-ink/60">{fromUnits(preview[i])}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function useSplit() {
  const [split, setSplit] = useState<Split | null>(null);
  const action = useAction();
  const load = (id: string) =>
    action.run("load", async () => {
      if (!/^\d+$/.test(id)) throw new Error("Split ids are whole numbers.");
      const s = await splitPay.read<Split>("get_split", [u64(BigInt(id))]);
      setSplit(s);
      return s;
    });
  return { split, setSplit, load, action };
}

function PayPanel({ wallet }: { wallet: Wallet }) {
  const { split, load, action } = useSplit();
  const [id, setId] = useState("");
  const [amount, setAmount] = useState("100");
  const [token, setToken] = useState(XLM_SAC);
  const [preview, setPreview] = useState<bigint[] | undefined>();
  const pay = useAction();

  async function refreshPreview(value = amount) {
    if (!split) return;
    try {
      setPreview(await splitPay.read<bigint[]>("preview", [u64(split.id), i128(toUnits(value))]));
    } catch {
      setPreview(undefined);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
      <div className="card p-6">
        <h2 className="font-display text-2xl font-bold text-plum">Pay into a split</h2>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            load(id).then(() => setPreview(undefined));
          }}
        >
          <input className="input" placeholder="Split id, e.g. 1" value={id} onChange={(e) => setId(e.target.value)} />
          <button className="btn btn-ghost" disabled={action.busy !== null}>
            {action.busy ? "Loading…" : "Load"}
          </button>
        </form>
        <div className="mt-3">
          <Status action={action} />
        </div>
        {split && (
          <form
            className="mt-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const payer = wallet.address ?? (await wallet.connect());
              if (!payer) return;
              await pay.run(
                "pay",
                () => splitPay.invoke(payer, "pay", [u64(split.id), addr(payer), addr(token), i128(toUnits(amount))]),
                (r) => ({ text: `Paid ${amount} into split #${split.id}.`, hash: r.hash }),
              );
            }}
          >
            <label className="block text-sm font-medium">
              Amount
              <input
                className="input mt-1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onBlur={() => refreshPreview()}
              />
            </label>
            <label className="block text-sm font-medium">
              Asset contract <span className="font-normal text-ink/50">(defaults to XLM)</span>
              <input className="input mt-1 font-mono text-xs" value={token} onChange={(e) => setToken(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => refreshPreview()}>
                Preview payouts
              </button>
              <button className="btn btn-coral" disabled={pay.busy !== null}>
                {pay.busy ? "Confirm in Freighter…" : wallet.address ? "Pay now" : "Connect & pay"}
              </button>
            </div>
            <Status action={pay} />
          </form>
        )}
      </div>
      <div className="card flex flex-col items-center p-6">
        {split ? (
          <>
            <Donut shares={split.recipients.map((r) => r.share_bps)} label={`#${split.id}`} />
            <div className="mt-5 w-full">
              <RecipientList split={split} preview={preview} />
            </div>
            {split.locked && <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-plum">🔒 Locked split</p>}
          </>
        ) : (
          <EmptyArt text="Load a split to see who gets paid." />
        )}
      </div>
    </div>
  );
}

function EmptyArt({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center py-10 text-center">
      <Donut shares={[6000, 2500, 1500]} size={140} />
      <p className="mt-4 max-w-xs text-sm text-ink/60">{text}</p>
    </div>
  );
}

function RecipientEditor({ rows, setRows }: { rows: Recipient[]; setRows: (r: Recipient[]) => void }) {
  const total = rows.reduce((a, r) => a + r.share_bps, 0);
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
          <input
            className="input font-mono text-xs"
            placeholder="G… or C… address"
            value={r.address}
            onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, address: e.target.value.trim() } : x)))}
          />
          <input
            className="input w-24 text-right"
            type="number"
            step="0.01"
            min="0"
            value={r.share_bps / 100}
            onChange={(e) =>
              setRows(rows.map((x, j) => (j === i ? { ...x, share_bps: Math.round(Number(e.target.value) * 100) } : x)))
            }
          />
          <span className="text-sm">%</span>
          <button
            type="button"
            className="px-2 text-lg text-ink/40 hover:text-coral"
            onClick={() => setRows(rows.filter((_, j) => j !== i))}
            aria-label="Remove recipient"
          >
            ×
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={rows.length >= 20}
          onClick={() => setRows([...rows, { address: "", share_bps: 0 }])}
        >
          + Add recipient
        </button>
        <span className={`text-sm font-semibold ${total === 10_000 ? "text-emerald-700" : "text-coral"}`}>
          {(total / 100).toFixed(2)}% / 100%
        </span>
      </div>
    </div>
  );
}

function validateRows(rows: Recipient[]) {
  if (rows.length === 0) throw new Error("Add at least one recipient.");
  for (const r of rows) {
    if (!StrKey.isValidEd25519PublicKey(r.address) && !StrKey.isValidContract(r.address)) {
      throw new Error(`"${short(r.address) || "(empty)"}" isn't a valid Stellar address.`);
    }
  }
  if (rows.reduce((a, r) => a + r.share_bps, 0) !== 10_000) throw new Error("Shares must add up to exactly 100%.");
}

function CreatePanel({ wallet, onCreated }: { wallet: Wallet; onCreated: () => void }) {
  const [rows, setRows] = useState<Recipient[]>([
    { address: "", share_bps: 6000 },
    { address: "", share_bps: 2500 },
    { address: "", share_bps: 1500 },
  ]);
  const action = useAction();
  return (
    <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
      <form
        className="card p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          const owner = wallet.address ?? (await wallet.connect());
          if (!owner) return;
          const res = await action.run(
            "create",
            async () => {
              validateRows(rows);
              return splitPay.invoke<bigint>(owner, "create_split", [addr(owner), recipientsScVal(rows)]);
            },
            (r) => ({ text: `Split #${r.result} created. Share the id with whoever pays you.`, hash: r.hash }),
          );
          if (res) setTimeout(onCreated, 2500);
        }}
      >
        <h2 className="font-display text-2xl font-bold text-plum">Create a split</h2>
        <p className="mt-1 text-sm text-ink/60">You'll be the owner. You can edit recipients until you lock the split.</p>
        <div className="mt-5">
          <RecipientEditor rows={rows} setRows={setRows} />
        </div>
        <div className="mt-6 space-y-3">
          <button className="btn btn-primary" disabled={action.busy !== null}>
            {action.busy ? "Confirm in Freighter…" : "Create split"}
          </button>
          <Status action={action} />
        </div>
      </form>
      <div className="card flex flex-col items-center justify-center p-6">
        <Donut shares={rows.map((r) => r.share_bps)} size={220} label={`${rows.length} way${rows.length === 1 ? "" : "s"}`} />
      </div>
    </div>
  );
}

function ManagePanel({ wallet }: { wallet: Wallet }) {
  const { split, setSplit, load, action } = useSplit();
  const [id, setId] = useState("");
  const [rows, setRows] = useState<Recipient[]>([]);
  const [newOwner, setNewOwner] = useState("");
  const write = useAction();
  const isOwner = !!split && wallet.address === split.owner;

  const reload = async () => {
    const s = await load(String(split?.id ?? id));
    if (s) setRows(s.recipients);
  };

  return (
    <div className="card p-6">
      <h2 className="font-display text-2xl font-bold text-plum">Manage a split</h2>
      <form
        className="mt-4 flex max-w-md gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const s = await load(id);
          if (s) setRows(s.recipients);
        }}
      >
        <input className="input" placeholder="Split id" value={id} onChange={(e) => setId(e.target.value)} />
        <button className="btn btn-ghost">Load</button>
      </form>
      <div className="mt-3">
        <Status action={action} />
      </div>
      {split && (
        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <div>
            <p className="text-sm text-ink/60">
              Owner <span className="font-mono">{short(split.owner, 6)}</span>
              {isOwner ? " (you)" : ""} · {split.locked ? "🔒 locked" : "editable"}
            </p>
            <div className="mt-4">
              {split.locked || !isOwner ? <RecipientList split={split} /> : <RecipientEditor rows={rows} setRows={setRows} />}
            </div>
            {!isOwner && !split.locked && (
              <p className="mt-4 text-sm text-ink/60">Connect the owner's wallet to edit this split.</p>
            )}
          </div>
          {isOwner && !split.locked && (
            <div className="space-y-5">
              <button
                className="btn btn-primary w-full"
                disabled={write.busy !== null}
                onClick={() =>
                  write.run(
                    "update",
                    async () => {
                      validateRows(rows);
                      const r = await splitPay.invoke(wallet.address!, "update_split", [u64(split.id), recipientsScVal(rows)]);
                      await reload();
                      return r;
                    },
                    (r) => ({ text: "Recipients updated.", hash: r.hash }),
                  )
                }
              >
                Save recipients
              </button>
              <div className="rounded-xl border border-line p-4">
                <p className="text-sm font-semibold">Transfer ownership</p>
                <input
                  className="input mt-2 font-mono text-xs"
                  placeholder="New owner (e.g. a multisig)"
                  value={newOwner}
                  onChange={(e) => setNewOwner(e.target.value.trim())}
                />
                <button
                  className="btn btn-ghost mt-2"
                  disabled={write.busy !== null}
                  onClick={() =>
                    write.run(
                      "transfer",
                      async () => {
                        const r = await splitPay.invoke(wallet.address!, "transfer_ownership", [u64(split.id), addr(newOwner)]);
                        setSplit({ ...split, owner: newOwner });
                        return r;
                      },
                      (r) => ({ text: "Ownership transferred.", hash: r.hash }),
                    )
                  }
                >
                  Transfer
                </button>
              </div>
              <div className="rounded-xl border border-coral/40 bg-coral/5 p-4">
                <p className="text-sm font-semibold text-coral">Lock forever</p>
                <p className="mt-1 text-xs text-ink/60">Recipients can never change again. This can't be undone.</p>
                <button
                  className="btn btn-coral mt-3"
                  disabled={write.busy !== null}
                  onClick={() =>
                    confirm("Lock this split permanently?") &&
                    write.run(
                      "lock",
                      async () => {
                        const r = await splitPay.invoke(wallet.address!, "lock_split", [u64(split.id)]);
                        await reload();
                        return r;
                      },
                      (r) => ({ text: "Split locked.", hash: r.hash }),
                    )
                  }
                >
                  Lock split
                </button>
              </div>
              <Status action={write} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
