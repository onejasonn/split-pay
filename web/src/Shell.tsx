import { useEffect, useRef, useState, type ReactNode } from "react";
import { CONTRACT_ID } from "./config";
import { contractLink } from "./lib/stellar";
import { short } from "./lib/format";
import { Link, useTitle } from "./lib/router";
import { WalletButton, type Wallet } from "./Workspace";

const NAV = [
  ["/", "Home"],
  ["/app", "App"],
  ["/docs", "Docs"],
] as const;

export function Shell({ route, wallet, children }: { route: string; wallet: Wallet; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Close on navigation; Escape closes and hands focus back to the toggle.
  useEffect(() => setOpen(false), [route]);
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-cream/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-8 w-8" />
            <span className="font-display text-xl font-bold text-plum">Split Pay</span>
            <span className="hidden rounded-full bg-plum/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-plum sm:inline">
              testnet
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(([to, label]) => (
              <Link
                key={to}
                to={to}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${route === to ? "bg-plum text-cream" : "text-plum hover:bg-white"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="hidden md:block">
            <WalletButton {...wallet} />
          </div>
          <button className="rounded-lg border border-line px-3 py-2 text-plum md:hidden" onClick={() => setOpen((v) => !v)} ref={toggleRef} aria-label="Menu" aria-controls="mobile-menu">
            {open ? "✕" : "☰"}
          </button>
        </div>
        {open && (
          <div id="mobile-menu" ref={menuRef} className="space-y-2 border-t border-line px-5 py-4 md:hidden" onClick={() => setOpen(false)}>
            {NAV.map(([to, label]) => (
              <Link key={to} to={to} className="block rounded-lg px-3 py-2 font-semibold text-plum hover:bg-white">
                {label}
              </Link>
            ))}
            <WalletButton {...wallet} />
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-16 border-t border-line bg-paper">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:grid-cols-3">
          <div>
            <p className="font-display text-lg font-bold text-plum">Split Pay</p>
            <p className="mt-2 text-sm text-ink/60">Revenue sharing on Stellar. One payment in, everyone paid out.</p>
          </div>
          <div className="text-sm">
            <p className="font-semibold text-plum">Product</p>
            <ul className="mt-2 space-y-1.5 text-ink/70">
              <li><Link to="/app">Open the app</Link></li>
              <li><Link to="/docs">Documentation</Link></li>
              <li><Link to="/docs/faq">FAQ</Link></li>
            </ul>
          </div>
          <div className="text-sm">
            <p className="font-semibold text-plum">Open source</p>
            <ul className="mt-2 space-y-1.5 text-ink/70">
              <li><a href="https://github.com/onejasonn/split-pay" target="_blank" rel="noreferrer">GitHub</a></li>
              <li><a href={contractLink(CONTRACT_ID)} target="_blank" rel="noreferrer">Contract {short(CONTRACT_ID, 4)}</a></li>
              <li><a href="https://github.com/onejasonn/split-pay/blob/main/LICENSE" target="_blank" rel="noreferrer">MIT license</a></li>
            </ul>
          </div>
        </div>
        <p className="pb-8 text-center text-xs text-ink/50">Runs on Stellar testnet. Not audited; don't use with real funds yet.</p>
      </footer>
    </div>
  );
}

export function NotFound() {
  useTitle("Not found · Split Pay");
  return (
    <section className="mx-auto max-w-xl px-5 py-24 text-center">
      <p className="font-display text-7xl font-extrabold text-coral">404</p>
      <p className="mt-3 text-ink/70">That page doesn't exist.</p>
      <Link to="/" className="btn btn-primary mt-6 inline-block">
        Back home
      </Link>
    </section>
  );
}
