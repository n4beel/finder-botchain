"use client";

import React, { useId } from "react";
import { formatBOT } from "@/lib/finder";

interface RelayDiagramProps {
  seller: `0x${string}`;
  buyer: `0x${string}` | null;
  finder: `0x${string}` | null;
  price: bigint;
  toSeller: bigint;
  toFinder: bigint;
  finderBps: number;
}

export function RelayDiagram({
  seller,
  buyer,
  finder,
  price,
  toSeller,
  toFinder,
  finderBps,
}: RelayDiagramProps) {
  const tableId = useId();
  const hasFinder = finder !== null && finder !== "0x0000000000000000000000000000000000000000";

  return (
    <div className="space-y-4">
      {/* 3-Node Relay Diagram */}
      <div className="bg-[#FFFDF5] border-2 border-[var(--border-default)] rounded-lg p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-amber-200/60 mb-5">
          <span className="font-heading text-sm text-[#2B1D00] tracking-wide uppercase">
            3-Node Payment Relay
          </span>
          <span className="text-xs font-mono text-[var(--text-muted)]">
            Total Price: {formatBOT(price)}
          </span>
        </div>

        {/* Relay Flow Nodes (Mobile stack, Desktop row) */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-2">
          {/* Node 1: Finder (Introducer) */}
          <div className="flex-1 w-full md:w-auto p-4 rounded-lg bg-white border-2 border-[var(--border-default)] text-center relative">
            <span className="absolute -top-2.5 left-4 px-2 py-0.5 rounded bg-[#264653] text-white text-[10px] font-mono uppercase tracking-wider">
              1. Finder Link
            </span>
            <div className="w-10 h-10 mx-auto rounded-full bg-amber-100 flex items-center justify-center font-bold text-sm text-[#264653] mb-2 font-mono">
              FD
            </div>
            <h4 className="font-bold text-xs text-[#2B1D00]">
              {hasFinder ? "Credited Finder" : "Direct / No Finder"}
            </h4>
            <p className="text-[11px] font-mono text-[var(--text-muted)] truncate max-w-[180px] mx-auto mt-0.5">
              {hasFinder ? finder : "None (0% Cut)"}
            </p>
            <div className="mt-2 text-xs font-mono font-bold text-emerald-700 bg-emerald-50 py-1 rounded">
              +{formatBOT(toFinder)} ({finderBps / 100}%)
            </div>
          </div>

          {/* Flow Arrow 1 */}
          <div className="hidden md:flex flex-col items-center justify-center text-[#264653]">
            <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
              Shares Link
            </span>
            <svg width="40" height="16" viewBox="0 0 40 16" fill="none">
              <path d="M0 8H35M35 8L28 2M35 8L28 14" stroke="#264653" strokeWidth="2" className="relay-flow-arrow" />
            </svg>
          </div>

          {/* Node 2: Buyer (Payer) */}
          <div className="flex-1 w-full md:w-auto p-4 rounded-lg bg-white border-2 border-[#264653] text-center relative shadow-xs">
            <span className="absolute -top-2.5 left-4 px-2 py-0.5 rounded bg-[#E9C46A] text-[#2B1D00] text-[10px] font-mono font-bold uppercase tracking-wider border border-[#B4954C]">
              2. Buyer (You)
            </span>
            <div className="w-10 h-10 mx-auto rounded-full bg-[#264653] text-white flex items-center justify-center font-bold text-sm mb-2 font-mono">
              BY
            </div>
            <h4 className="font-bold text-xs text-[#2B1D00]">Purchaser</h4>
            <p className="text-[11px] font-mono text-[var(--text-muted)] truncate max-w-[180px] mx-auto mt-0.5">
              {buyer ? buyer : "Connect wallet to buy"}
            </p>
            <div className="mt-2 text-xs font-mono font-bold text-[#2B1D00] bg-amber-100/70 py-1 rounded">
              Pays {formatBOT(price)}
            </div>
          </div>

          {/* Flow Arrow 2 */}
          <div className="hidden md:flex flex-col items-center justify-center text-[#264653]">
            <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
              Net Price
            </span>
            <svg width="40" height="16" viewBox="0 0 40 16" fill="none">
              <path d="M0 8H35M35 8L28 2M35 8L28 14" stroke="#264653" strokeWidth="2" className="relay-flow-arrow" />
            </svg>
          </div>

          {/* Node 3: Seller (Merchant) */}
          <div className="flex-1 w-full md:w-auto p-4 rounded-lg bg-white border-2 border-[var(--border-default)] text-center relative">
            <span className="absolute -top-2.5 left-4 px-2 py-0.5 rounded bg-[#2B1D00] text-white text-[10px] font-mono uppercase tracking-wider">
              3. Seller
            </span>
            <div className="w-10 h-10 mx-auto rounded-full bg-amber-100 flex items-center justify-center font-bold text-sm text-[#2B1D00] mb-2 font-mono">
              SL
            </div>
            <h4 className="font-bold text-xs text-[#2B1D00]">Offer Host</h4>
            <p className="text-[11px] font-mono text-[var(--text-muted)] truncate max-w-[180px] mx-auto mt-0.5">
              {seller}
            </p>
            <div className="mt-2 text-xs font-mono font-bold text-[#2B1D00] bg-amber-50 py-1 rounded">
              +{formatBOT(toSeller)} ({100 - (hasFinder ? finderBps / 100 : 0)}%)
            </div>
          </div>
        </div>

        {/* Split Bar */}
        <div className="mt-5 pt-4 border-t border-amber-200/60">
          <div className="flex items-center justify-between text-xs font-mono mb-1.5">
            <span className="font-bold text-[#2B1D00]">Seller receives {formatBOT(toSeller)}</span>
            <span className="font-bold text-emerald-800">Finder receives {formatBOT(toFinder)}</span>
          </div>

          <div className="w-full h-3 bg-amber-200 rounded-full overflow-hidden flex">
            <div
              className="bg-[#264653] h-full transition-all"
              style={{ width: `${100 - (hasFinder ? finderBps / 100 : 0)}%` }}
            ></div>
            {hasFinder && (
              <div
                className="bg-emerald-600 h-full transition-all"
                style={{ width: `${finderBps / 100}%` }}
              ></div>
            )}
          </div>
        </div>
      </div>

      {/* Accessible Split Table Equivalent for Screen Readers & High Accessibility */}
      <div className="sr-only">
        <table id={tableId}>
          <caption>Commission and split distribution for this purchase</caption>
          <thead>
            <tr>
              <th>Role</th>
              <th>Recipient Address</th>
              <th>Percentage Cut</th>
              <th>Payout Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Seller</td>
              <td>{seller}</td>
              <td>{100 - (hasFinder ? finderBps / 100 : 0)}%</td>
              <td>{formatBOT(toSeller)}</td>
            </tr>
            {hasFinder && (
              <tr>
                <td>Finder</td>
                <td>{finder}</td>
                <td>{finderBps / 100}%</td>
                <td>{formatBOT(toFinder)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
