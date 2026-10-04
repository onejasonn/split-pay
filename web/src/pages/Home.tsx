import { useEffect, useState } from "react";
import { splitPay, type Split } from "../config";
import { Donut } from "../components/Donut";
import { u64 } from "../lib/stellar";
import { short } from "../lib/format";
import { Link, useTitle } from "../lib/router";

const USE_CASES = [
  ["🎵", "Music royalties", "Artist 60%, producer 25%, label 15%: every stream payout split on arrival."],
  ["🛍️", "Marketplaces", "Seller 95%, platform 5%, settled at checkout with no nightly payout job."],
  ["🤝", "Collectives & DAOs", "Contributors paid the moment revenue lands, by rules everyone can read."],
  ["📣", "Affiliates", "Referrers get their cut automatically, with no monthly reconciliation."],
];

export function Home() {
  useTitle("Split Pay · one payment in, everyone paid out");
  const [count, setCount] = useState<bigint | null>(null);
  const [demo, setDemo] = useState<Split | null>(null);
  useEffect(() => {
    splitPay.read<bigint>("split_count").then(setCount).catch(() => {});
    splitPay.read<Split>("get_split", [u64(1n)]).then(setDemo).catch(() => {});
  }, []);

  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-12 md:grid-cols-[1.25fr_1fr] md:pt-20">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Revenue sharing on Stellar</p>
          <h1 className="mt-3 font-display text-5xl font-extrabold leading-[1.02] text-plum md:text-7xl">
            One payment in. <span className="italic text-coral">Everyone</span> paid out.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink/75">
            Register who gets what once. Every payment into the split fans out to each recipient in the same
            transaction, in any Stellar asset. No custody, no payout runs, no spreadsheets.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/app" className="btn btn-coral">
              Open the app →
            </Link>
            <Link to="/docs" className="btn btn-ghost text-plum">
              How it works
            </Link>
          </div>
          <dl className="mt-10 flex gap-10">
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink/50">Splits on testnet</dt>
              <dd className="font-display text-3xl font-bold text-plum">{count === null ? "…" : String(count)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink/50">Custody</dt>
              <dd className="font-display text-3xl font-bold text-plum">None</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink/50">Max recipients</dt>
              <dd className="font-display text-3xl font-bold text-plum">20</dd>
            </div>
          </dl>
        </div>
        <div className="card flex flex-col items-center p-8">
          <Donut shares={demo ? demo.recipients.map((r) => r.share_bps) : [6000, 2500, 1500]} size={240} label={demo ? `#${demo.id}` : "60·25·15"} />
          <p className="mt-4 text-center text-sm text-ink/60">
            {demo ? (
              <>
                Live split #{String(demo.id)} with {demo.recipients.length} recipients, owned by{" "}
                <span className="font-mono">{short(demo.owner)}</span>
              </>
            ) : (
              "A typical royalty split"
            )}
          </p>
          <Link to="/app" className="mt-4 text-sm font-semibold text-coral underline">
            Pay into it →
          </Link>
        </div>
      </section>

      <section className="border-y border-line bg-paper">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="font-display text-3xl font-bold text-plum">How it works</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              ["Create a split", "List recipients and their percentages (they must add up to 100%). You're the owner."],
              ["Share the split id", "Payers only need the id: on an invoice, at checkout, in a smart contract."],
              ["Everyone gets paid", "Each payment is divided pro-rata and sent straight to every recipient, at once."],
            ].map(([t, d], i) => (
              <li key={t} className="card p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-coral font-display font-bold text-white">{i + 1}</span>
                <h3 className="mt-4 font-display text-xl font-bold text-plum">{t}</h3>
                <p className="mt-2 text-sm text-ink/70">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="font-display text-3xl font-bold text-plum">Built for people who share revenue</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {USE_CASES.map(([icon, t, d]) => (
            <div key={t} className="card p-6">
              <span className="text-3xl">{icon}</span>
              <h3 className="mt-3 font-display text-lg font-bold text-plum">{t}</h3>
              <p className="mt-2 text-sm text-ink/70">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-5 md:grid-cols-3">
        {[
          ["No custody", "Payouts go straight from the payer to each recipient. The contract never holds a balance, so there's nothing to drain."],
          ["Nothing lost to rounding", "Shares round down and the leftover goes to the first recipient, so payouts always add up exactly."],
          ["Lock it forever", "Freeze a split so collaborators can verify on-chain that the deal can never change."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-2xl bg-plum p-7 text-cream">
            <h3 className="font-display text-xl font-bold">{t}</h3>
            <p className="mt-2 text-sm text-cream/75">{d}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-16">
        <div className="card flex flex-col items-start justify-between gap-6 p-10 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-3xl font-bold text-plum">Set up your first split in a minute.</h2>
            <p className="mt-2 text-ink/70">Install Freighter, switch it to Testnet, fund it with Friendbot, and go.</p>
          </div>
          <Link to="/app" className="btn btn-coral shrink-0">
            Create a split
          </Link>
        </div>
      </section>
    </>
  );
}
