import { CONTRACT_ID } from "../config";
import { contractLink } from "../lib/stellar";
import { useEffect } from "react";
import { Link, useSection, useTitle } from "../lib/router";

const SECTIONS = [
  ["start", "Getting started"],
  ["concepts", "Concepts"],
  ["reference", "Contract reference"],
  ["faq", "FAQ"],
] as const;

const FAQ = [
  ["Does the contract ever hold my money?", "No. Each payment transfers directly from the payer to every recipient in one transaction. There's no balance to withdraw and nothing to drain."],
  ["What happens to rounding?", "Each share is rounded down; the remainder (at most one smallest unit per recipient) goes to the first recipient, so the total paid out always equals the amount paid in."],
  ["Which assets can I use?", "Any Stellar asset with a Stellar Asset Contract, including native XLM and USDC. The split doesn't care which asset arrives."],
  ["Can I change recipients later?", "Yes, as the owner, until you lock the split. Locking is permanent and proves to collaborators the deal can't change."],
  ["Can a team own a split?", "Transfer ownership to a multisig contract (e.g. Quorum Vault) so changes need several approvals."],
  ["Is this audited?", "Not yet. It runs on testnet; treat it as a working prototype until it's audited."],
];

export function Docs() {
  useTitle("Docs · Split Pay");
  const section = useSection();
  useEffect(() => {
    if (section) document.getElementById(section)?.scrollIntoView({ behavior: "smooth" });
  }, [section]);
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[220px_1fr]">
      <aside className="hidden lg:block">
        <nav className="sticky top-24 space-y-1 text-sm">
          {SECTIONS.map(([id, label]) => (
            <Link key={id} to={`/docs/${id}`} className="block rounded-lg px-3 py-2 text-plum hover:bg-white">
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <article className="space-y-14">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Documentation</p>
          <h1 className="mt-2 font-display text-5xl font-extrabold text-plum">How Split Pay works</h1>
        </header>

        <section id="start" className="space-y-4">
          <h2 className="font-display text-3xl font-bold text-plum">Getting started</h2>
          <ol className="list-decimal space-y-2 pl-5 text-ink/80">
            <li>Install the <a className="underline" href="https://www.freighter.app" target="_blank" rel="noreferrer">Freighter</a> browser wallet and switch it to <b>Testnet</b>.</li>
            <li>Fund your account with test XLM from <a className="underline" href="https://lab.stellar.org/account/fund" target="_blank" rel="noreferrer">Friendbot</a>.</li>
            <li>Open the <Link to="/app" className="underline">app</Link>, choose <b>Create a split</b>, add recipients and percentages, and sign.</li>
            <li>Share the split id. Anyone can pay into it from the <b>Pay into a split</b> tab.</li>
          </ol>
        </section>

        <section id="concepts" className="space-y-4">
          <h2 className="font-display text-3xl font-bold text-plum">Concepts</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["Split", "A list of up to 20 recipients with shares in basis points (10,000 = 100%). Shares must add up to exactly 100%."],
              ["Owner", "The address that can update, lock or transfer the split. Often a multisig for teams."],
              ["Payment", "pay(split, payer, asset, amount) transfers each recipient's share directly from the payer."],
              ["Lock", "A one-way switch that freezes the recipients forever."],
            ].map(([t, d]) => (
              <div key={t} className="card p-5">
                <h3 className="font-display text-lg font-bold text-plum">{t}</h3>
                <p className="mt-1 text-sm text-ink/70">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="reference" className="space-y-4">
          <h2 className="font-display text-3xl font-bold text-plum">Contract reference</h2>
          <p className="text-ink/70">
            Deployed on testnet at{" "}
            <a className="font-mono text-sm underline" href={contractLink(CONTRACT_ID)} target="_blank" rel="noreferrer">
              {CONTRACT_ID}
            </a>
          </p>
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wider text-ink/50">
                <tr><th className="p-3">Function</th><th className="p-3">Signer</th><th className="p-3">What it does</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[
                  ["create_split(owner, recipients)", "owner", "Registers a split, returns its id"],
                  ["update_split(id, recipients)", "owner", "Replaces recipients (until locked)"],
                  ["lock_split(id)", "owner", "Freezes recipients forever"],
                  ["propose_owner(id, new_owner) · accept_ownership(id)", "owner · new owner", "Two-step handover: nothing changes until the new owner accepts"],
                  ["cancel_ownership_transfer(id)", "owner", "Withdraws a pending handover"],
                  ["transfer_ownership(id, new_owner)", "owner", "One-step handover (prefer the two steps above)"],
                  ["pay(id, payer, token, amount)", "payer", "Pays every recipient their share"],
                  ["preview(id, amount)", "—", "Shows each payout without moving funds"],
                  ["get_split(id) · split_count()", "—", "Read state"],
                ].map(([f, s, d]) => (
                  <tr key={f}><td className="p-3 font-mono text-xs">{f}</td><td className="p-3">{s}</td><td className="p-3 text-ink/70">{d}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="faq" className="space-y-3">
          <h2 className="font-display text-3xl font-bold text-plum">FAQ</h2>
          {FAQ.map(([q, a]) => (
            <details key={q} className="card group p-5">
              <summary className="cursor-pointer list-none font-semibold text-plum">
                <span className="mr-2 inline-block transition group-open:rotate-90">›</span>
                {q}
              </summary>
              <p className="mt-3 text-sm text-ink/70">{a}</p>
            </details>
          ))}
        </section>
      </article>
    </div>
  );
}
