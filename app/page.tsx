"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, usePublicClient } from "wagmi";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { BOTCHAIN_ABI } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { formatBOT, OfferData } from "@/lib/finder";

export default function HomePage() {
  const { isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: activeBotChain.id });
  const deployment = getDeployment(activeBotChain.id);

  const [offers, setOffers] = useState<OfferData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOffers() {
      if (!publicClient || !deployment?.address) {
        setLoading(false);
        return;
      }
      try {
        const result = (await publicClient.readContract({
          address: deployment.address,
          abi: BOTCHAIN_ABI,
          functionName: "latest",
          args: [0n, 50n],
        })) as [bigint[], any[], bigint];

        const [ids, rawOffers] = result;
        const parsed: OfferData[] = [];
        for (let i = 0; i < ids.length; i++) {
          const o = rawOffers[i];
          parsed.push({
            id: ids[i],
            seller: o.seller,
            endsAt: o.endsAt,
            stock: o.stock,
            sold: o.sold,
            finderBps: o.finderBps,
            openedBlock: o.openedBlock,
            price: o.price,
            name: o.name,
          });
        }
        setOffers(parsed);
      } catch (e) {
        console.error("Failed to load offers", e);
      } finally {
        setLoading(false);
      }
    }
    loadOffers();
    const interval = setInterval(loadOffers, 8000);
    return () => clearInterval(interval);
  }, [deployment?.address]);

  return (
    <PageShell
      headline="Commission Relay Market"
      lead="Pay whoever brought the buyer. Anyone can share an offer link and earn the finder cut upon sale."
      activeNav="offers"
      controls={
        <Link href="/list">
          <Button tier="sm" intent="relay">
            + List an Offer
          </Button>
        </Link>
      }
    >
      {/* Required Disclaimer Banner: What a finder is */}
      <Panel styling="card" className="mb-6 border-l-4 border-l-[#264653] bg-amber-50/90">
        <h2 className="font-heading text-xs uppercase tracking-wider text-[#2B1D00] mb-1">
          What a finder is
        </h2>
        <ul className="text-xs text-[var(--text-secondary)] space-y-1 list-disc list-inside">
          <li>
            The finder is whoever is in the link you opened. Nothing proves they brought you.
          </li>
          <li>
            A finder can use another wallet to buy through their own link.
          </li>
          <li>
            This moves money only. The goods are the seller&apos;s to deliver.
          </li>
        </ul>
      </Panel>

      {/* Offers Listing as Relay Strips */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <h3 className="font-heading text-sm text-[#2B1D00] uppercase tracking-wide">
          Active Offers ({offers.length})
        </h3>
        <span className="text-xs font-mono text-[var(--text-muted)]">
          Realtime feed
        </span>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs font-mono text-[var(--text-secondary)]">
          Scanning relay offers...
        </div>
      ) : offers.length === 0 ? (
        <div className="bg-[#FFF8E0] border-2 border-dashed border-[var(--border-default)] rounded-lg p-12 text-center">
          <p className="font-bold text-[#2B1D00] text-sm mb-1">No offers listed yet</p>
          <p className="text-xs text-[var(--text-secondary)] mb-4">
            Be the first seller to list an item with a finder reward.
          </p>
          <Link href="/list">
            <Button tier="sm">List First Offer</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => {
            const isSoldOut = offer.sold >= offer.stock;
            const isEnded = Number(offer.endsAt) * 1000 <= Date.now();
            const pctSold = offer.stock > 0 ? (offer.sold / offer.stock) * 100 : 0;

            return (
              <Link
                key={offer.id.toString()}
                href={`/offer/${offer.id}`}
                className="block group"
              >
                <div className="bg-[#FFFDF5] border-2 border-[var(--border-default)] hover:border-[#264653] rounded-lg p-4 transition-all shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Offer info */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded bg-[#E9C46A] text-[#2B1D00] font-mono font-bold flex items-center justify-center shrink-0 border border-[#B4954C]">
                      #{offer.id.toString()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-base text-[#2B1D00] group-hover:underline">
                          {offer.name}
                        </h4>
                        {isSoldOut ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-200 text-neutral-800">
                            SOLD OUT
                          </span>
                        ) : isEnded ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-100 text-red-800">
                            ENDED
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                            AVAILABLE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] font-mono mt-0.5">
                        Seller: {offer.seller.slice(0, 6)}...{offer.seller.slice(-4)}
                      </p>
                    </div>
                  </div>

                  {/* Right: Metrics & Stock bar */}
                  <div className="flex items-center gap-4 sm:gap-6 font-mono text-xs border-t md:border-t-0 md:border-l border-amber-200/60 pt-3 md:pt-0 md:pl-6">
                    <div>
                      <span className="block text-[10px] uppercase text-[var(--text-muted)]">
                        Price
                      </span>
                      <span className="font-bold text-sm text-[#2B1D00]">
                        {formatBOT(offer.price)}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] uppercase text-[var(--text-muted)]">
                        Finder Cut
                      </span>
                      <span className="font-bold text-emerald-700">
                        {offer.finderBps / 100}%
                      </span>
                    </div>

                    <div className="min-w-[100px]">
                      <div className="flex justify-between text-[10px] uppercase text-[var(--text-muted)] mb-1">
                        <span>Stock</span>
                        <span>{offer.sold}/{offer.stock}</span>
                      </div>
                      <div className="w-full h-2 bg-amber-200 rounded-full overflow-hidden">
                        <div
                          className="bg-[#264653] h-full"
                          style={{ width: `${pctSold}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="hidden sm:block">
                      <Button tier="sm" intent="ghost" className="pointer-events-none">
                        View Relay →
                      </Button>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
