import React from "react";
import Link from "next/link";
import ConnectButton from "../ui/ConnectButton";
import BuiltOnBotChain from "../botchain/BuiltOnBotChain";
import { footerLinks } from "@/lib/botchain/chain";

export interface PageShellProps {
  children: React.ReactNode;
  headline?: string;
  lead?: string;
  badge?: React.ReactNode;
  controls?: React.ReactNode;
  activeNav?: "offers" | "list" | "me";
}

export function PageShell({
  children,
  headline,
  lead,
  badge,
  controls,
  activeNav = "offers",
}: PageShellProps) {
  const { site, explorer } = footerLinks();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)] font-sans">
      {/* Relay Masthead Header */}
      <header className="border-b-4 border-[#2B1D00] bg-[#264653] text-white px-4 py-3 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 group">
              <span className="w-8 h-8 rounded-full bg-[#E9C46A] text-[#2B1D00] font-black text-sm flex items-center justify-center border-2 border-white shadow-xs font-mono">
                FD
              </span>
              <span className="font-heading text-2xl tracking-wide text-white">
                Finder
              </span>
            </Link>
            <nav className="hidden sm:flex items-center gap-2 text-xs font-mono font-medium">
              <Link
                href="/"
                className={`px-3 py-1.5 rounded transition-colors ${
                  activeNav === "offers"
                    ? "bg-[#E9C46A] text-[#2B1D00] font-bold"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                Relay Offers
              </Link>
              <Link
                href="/list"
                className={`px-3 py-1.5 rounded transition-colors ${
                  activeNav === "list"
                    ? "bg-[#E9C46A] text-[#2B1D00] font-bold"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                + List Offer
              </Link>
              <Link
                href="/me"
                className={`px-3 py-1.5 rounded transition-colors ${
                  activeNav === "me"
                    ? "bg-[#E9C46A] text-[#2B1D00] font-bold"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                Finder Earnings
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Relay Headline Ribbon */}
      {(headline || lead || controls) && (
        <section className="bg-[var(--bg-surface)] border-b-2 border-[var(--border-default)] px-4 py-5 sm:px-6 shadow-xs">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                {headline && <h1 className="font-heading text-2xl sm:text-3xl text-[#2B1D00] tracking-wide">{headline}</h1>}
                {badge}
              </div>
              {lead && <p className="text-xs text-[var(--text-secondary)] mt-1 font-medium">{lead}</p>}
            </div>
            {controls && <div className="flex items-center gap-2">{controls}</div>}
          </div>
        </section>
      )}

      {/* Main Relay Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 sm:px-6">{children}</main>

      {/* Required 3-link Footer */}
      <footer className="border-t-4 border-[#2B1D00] bg-[#264653] text-white/80 text-xs px-4 py-4 sm:px-6 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
          <BuiltOnBotChain />
          <div className="flex items-center gap-6">
            <a href={site} target="_blank" rel="noreferrer" className="hover:text-[#E9C46A] transition-colors">
              botchain.ai
            </a>
            <a href={explorer} target="_blank" rel="noreferrer" className="hover:text-[#E9C46A] transition-colors">
              BOT Chain Explorer
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default PageShell;
