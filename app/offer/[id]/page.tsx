"use client";

import React, { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount, usePublicClient } from "wagmi";
import QRCode from "qrcode";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { RelayDiagram } from "@/components/relay/RelayDiagram";
import { useWriteContract } from "@/lib/useChainWrite";
import { BOTCHAIN_ABI } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { formatFinderError } from "@/lib/errors";
import {
  OfferData,
  FinderTally,
  split,
  finderLink,
  parseFinderParam,
  formatBOT,
} from "@/lib/finder";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function OfferDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const offerId = BigInt(resolvedParams.id);
  const searchParams = useSearchParams();
  const rawF = searchParams.get("f");

  const { address: userAddress, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: activeBotChain.id });
  const deployment = getDeployment(activeBotChain.id);
  const { writeContractAsync, isPending } = useWriteContract();

  const [offer, setOffer] = useState<OfferData | null>(null);
  const [description, setDescription] = useState<string>("");
  const [leaderboard, setLeaderboard] = useState<FinderTally[]>([]);
  const [activeFinder, setActiveFinder] = useState<`0x${string}` | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Initial finder parse from ?f=
  useEffect(() => {
    const parsed = parseFinderParam(rawF);
    setActiveFinder(parsed);
  }, [rawF]);

  const refreshOfferData = async () => {
    if (!publicClient || !deployment?.address) return;
    try {
      const o = (await publicClient.readContract({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "offerOf",
        args: [offerId],
      })) as any;

      const loadedOffer: OfferData = {
        id: offerId,
        seller: o.seller,
        endsAt: o.endsAt,
        stock: o.stock,
        sold: o.sold,
        finderBps: o.finderBps,
        openedBlock: o.openedBlock,
        price: o.price,
        name: o.name,
      };
      setOffer(loadedOffer);

      // Read description from Listed event at openedBlock
      try {
        const logs = await publicClient.getLogs({
          address: deployment.address,
          event: {
            type: "event",
            name: "Listed",
            inputs: [
              { indexed: true, name: "id", type: "uint256" },
              { indexed: true, name: "seller", type: "address" },
              { indexed: false, name: "name", type: "string" },
              { indexed: false, name: "description", type: "string" },
              { indexed: false, name: "price", type: "uint128" },
              { indexed: false, name: "finderBps", type: "uint16" },
              { indexed: false, name: "stock", type: "uint32" },
              { indexed: false, name: "endsAt", type: "uint64" },
            ],
          },
          args: { id: offerId },
          fromBlock: BigInt(o.openedBlock),
          toBlock: BigInt(o.openedBlock + 5),
        });
        if (logs.length > 0 && logs[0].args) {
          setDescription((logs[0].args as any).description || "");
        }
      } catch (err) {
        console.warn("Could not read description log", err);
      }

      // Read Bought events to build finders leaderboard
      try {
        const boughtLogs = await publicClient.getLogs({
          address: deployment.address,
          event: {
            type: "event",
            name: "Bought",
            inputs: [
              { indexed: true, name: "id", type: "uint256" },
              { indexed: true, name: "buyer", type: "address" },
              { indexed: true, name: "finder", type: "address" },
              { indexed: false, name: "price", type: "uint128" },
              { indexed: false, name: "commission", type: "uint128" },
            ],
          },
          args: { id: offerId },
          fromBlock: BigInt(o.openedBlock),
          toBlock: "latest",
        });

        // Collect unique non-zero finders
        const findersSet = new Set<`0x${string}`>();
        for (const log of boughtLogs) {
          const f = (log.args as any).finder as `0x${string}`;
          if (f && f !== "0x0000000000000000000000000000000000000000") {
            findersSet.add(f);
          }
        }

        // Query foundOn for each finder
        const tallies: FinderTally[] = [];
        for (const f of Array.from(findersSet)) {
          const [buyersCount, earnedAmt] = (await publicClient.readContract({
            address: deployment.address,
            abi: BOTCHAIN_ABI,
            functionName: "foundOn",
            args: [offerId, f],
          })) as [number, bigint];

          tallies.push({
            finder: f,
            buyers: buyersCount,
            earned: earnedAmt,
          });
        }

        // Sort descending by earned
        tallies.sort((a, b) => (b.earned > a.earned ? 1 : -1));
        setLeaderboard(tallies);
      } catch (err) {
        console.warn("Could not read bought logs", err);
      }
    } catch (e) {
      console.error("Error reading offer", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshOfferData();
    const interval = setInterval(refreshOfferData, 8000);
    return () => clearInterval(interval);
  }, [deployment?.address, offerId]);

  // Generate QR code for user's personal finder link
  useEffect(() => {
    if (typeof window === "undefined" || !userAddress || !offer) return;
    const myLink = finderLink(window.location.origin, offer.id, userAddress);
    QRCode.toDataURL(myLink, { width: 140, margin: 1 })
      .then(setQrCodeUrl)
      .catch((e) => console.error("QR generation error", e));
  }, [userAddress, offer]);

  if (loading || !offer) {
    return (
      <PageShell headline="Loading Offer..." activeNav="offers">
        <div className="p-12 text-center text-xs font-mono text-[var(--text-secondary)]">
          Fetching offer and relay data...
        </div>
      </PageShell>
    );
  }

  // Validate active finder: cannot be buyer, cannot be seller, cannot be contract
  let effectiveFinder = activeFinder;
  let finderWarning: string | null = null;

  if (activeFinder) {
    if (userAddress && activeFinder.toLowerCase() === userAddress.toLowerCase()) {
      effectiveFinder = null;
      finderWarning = "You cannot be the finder for your own purchase. The link's finder parameter was ignored.";
    } else if (activeFinder.toLowerCase() === offer.seller.toLowerCase()) {
      effectiveFinder = null;
      finderWarning = "The seller cannot be the finder. The link's finder parameter was ignored.";
    }
  }

  const hasFinder = effectiveFinder !== null;
  const { toSeller, toFinder } = split(offer.price, offer.finderBps, hasFinder);

  const isSoldOut = offer.sold >= offer.stock;
  const isEnded = Number(offer.endsAt) * 1000 <= Date.now();
  const isSeller = userAddress && offer.seller.toLowerCase() === userAddress.toLowerCase();

  const handleBuy = async () => {
    if (!deployment?.address || !offer) return;
    setActionError(null);
    setActionSuccess(null);

    const fAddr = effectiveFinder || "0x0000000000000000000000000000000000000000";

    try {
      const tx = await writeContractAsync({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "buy",
        args: [offerId, fAddr],
        value: offer.price,
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }

      setActionSuccess(`Purchase completed! ${hasFinder ? "Finder and seller were credited." : "Seller was credited."}`);
      await refreshOfferData();
    } catch (err) {
      setActionError(formatFinderError(err));
    }
  };

  const copyMyLink = () => {
    if (typeof window === "undefined" || !userAddress || !offer) return;
    const myLink = finderLink(window.location.origin, offer.id, userAddress);
    navigator.clipboard.writeText(myLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <PageShell
      headline={offer.name}
      lead={`Offer #${offer.id.toString()} • Seller: ${offer.seller}`}
      activeNav="offers"
      badge={
        isSoldOut ? (
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-neutral-200 text-neutral-800">
            SOLD OUT
          </span>
        ) : isEnded ? (
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-red-100 text-red-800">
            ENDED
          </span>
        ) : (
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
            AVAILABLE ({offer.stock - offer.sold} left)
          </span>
        )
      }
    >
      {/* Action alerts */}
      {actionError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
          {actionSuccess}
        </div>
      )}
      {finderWarning && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded text-xs text-amber-900">
          {finderWarning}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Relay Diagram + Leaderboard */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description Block */}
          {description && (
            <Panel styling="card">
              <h3 className="font-heading text-xs uppercase tracking-wider text-[#2B1D00] mb-2">
                About this Offer
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-sans">
                {description}
              </p>
            </Panel>
          )}

          {/* 3-Node Visual Relay Diagram */}
          <RelayDiagram
            seller={offer.seller}
            buyer={userAddress || null}
            finder={effectiveFinder}
            price={offer.price}
            toSeller={toSeller}
            toFinder={toFinder}
            finderBps={offer.finderBps}
          />

          {/* Leaderboard of Finders */}
          <Panel styling="card">
            <div className="flex items-center justify-between pb-3 border-b border-amber-200/60 mb-4">
              <h3 className="font-heading text-sm text-[#2B1D00] uppercase tracking-wide">
                Top Finders for this Offer ({leaderboard.length})
              </h3>
              <span className="text-xs font-mono text-[var(--text-muted)]">
                Ranked by commission
              </span>
            </div>

            {leaderboard.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] font-mono py-4 text-center">
                No finders have brought buyers to this offer yet. Share your link below!
              </p>
            ) : (
              <div className="space-y-3 font-mono">
                {leaderboard.map((item, idx) => {
                  const maxEarned = leaderboard[0].earned || 1n;
                  const barWidth = Number((item.earned * 100n) / maxEarned);
                  const isUser = userAddress && item.finder.toLowerCase() === userAddress.toLowerCase();

                  return (
                    <div
                      key={item.finder}
                      className={`p-3 rounded border ${
                        isUser ? "bg-amber-100/70 border-[#264653]" : "bg-white border-amber-200/60"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#2B1D00]">#{idx + 1}</span>
                          <span className="truncate max-w-[160px] sm:max-w-xs">{item.finder}</span>
                          {isUser && (
                            <span className="text-[10px] bg-[#264653] text-white px-1.5 rounded font-sans">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-emerald-800">
                            {formatBOT(item.earned)}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] ml-2">
                            ({item.buyers} {item.buyers === 1 ? "buyer" : "buyers"})
                          </span>
                        </div>
                      </div>

                      {/* Visual Bar */}
                      <div className="w-full h-2 bg-amber-100 rounded-full overflow-hidden">
                        <div
                          className="bg-[#264653] h-full"
                          style={{ width: `${Math.max(5, barWidth)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        {/* Right Column (1 Col): Buy Box & "Get my finder link" */}
        <div className="space-y-6">
          {/* Purchase Box */}
          <Panel styling="card" className="border-2 border-[#264653]">
            <h3 className="font-heading text-sm text-[#2B1D00] uppercase tracking-wide mb-3">
              Purchase Offer
            </h3>

            <div className="space-y-3 mb-5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Price</span>
                <span className="font-bold text-[#2B1D00]">{formatBOT(offer.price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Finder Cut</span>
                <span className="font-bold text-emerald-800">{offer.finderBps / 100}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Stock</span>
                <span>{offer.sold} / {offer.stock} sold</span>
              </div>
            </div>

            {/* Attribution Status */}
            <div className="bg-white border border-amber-200 rounded p-3 mb-4 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[#2B1D00]">Attributed Finder:</span>
                {hasFinder && (
                  <button
                    onClick={() => setActiveFinder(null)}
                    className="text-[10px] text-red-700 hover:underline cursor-pointer"
                  >
                    Buy without a finder
                  </button>
                )}
              </div>
              <p className="font-mono text-[11px] text-[var(--text-secondary)] break-all">
                {hasFinder ? effectiveFinder : "None (Direct purchase, 100% to seller)"}
              </p>
            </div>

            {/* Buy CTA */}
            {isSeller ? (
              <div className="p-3 bg-amber-100 rounded text-xs text-[#2B1D00] font-mono text-center">
                You are the seller of this offer.
              </div>
            ) : isSoldOut ? (
              <div className="p-3 bg-neutral-100 rounded text-xs text-neutral-600 font-mono text-center">
                This offer is sold out.
              </div>
            ) : isEnded ? (
              <div className="p-3 bg-red-50 text-red-800 rounded text-xs font-mono text-center">
                This offer has expired.
              </div>
            ) : (
              <Button
                tier="lg"
                intent="relay"
                className="w-full"
                disabled={isPending || !isConnected}
                onClick={handleBuy}
              >
                {isPending ? "Purchasing..." : `Buy for ${formatBOT(offer.price)}`}
              </Button>
            )}

            <p className="text-[11px] text-[var(--text-muted)] font-mono text-center mt-2">
              You pay {formatBOT(offer.price)}. Seller gets {formatBOT(toSeller)}
              {hasFinder && ` and finder gets ${formatBOT(toFinder)}`}.
            </p>
          </Panel>

          {/* "Get My Finder Link" Share Box */}
          <Panel styling="card" className="border-2 border-[var(--border-default)]">
            <h3 className="font-heading text-sm text-[#2B1D00] uppercase tracking-wide mb-1">
              Get Your Finder Link
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              Share this offer. When anyone buys through your link or QR code, you earn{" "}
              <strong className="text-emerald-800">{offer.finderBps / 100}% ({formatBOT(toFinder)})</strong> instantly!
            </p>

            {!isConnected ? (
              <div className="p-3 bg-amber-100/70 rounded text-xs text-center font-mono">
                Connect your wallet to generate your personal finder link & QR code.
              </div>
            ) : (
              <div className="space-y-4">
                {/* QR Code Container */}
                {qrCodeUrl && (
                  <div className="bg-white p-3 rounded border border-amber-200 flex flex-col items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrCodeUrl} alt="Finder referral QR code" className="w-32 h-32" />
                    <span className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
                      Scan to buy with your referral
                    </span>
                  </div>
                )}

                {/* Link input + Copy */}
                <div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={typeof window !== "undefined" ? finderLink(window.location.origin, offer.id, userAddress!) : ""}
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-amber-200 rounded text-[var(--text-secondary)] select-all focus:outline-none"
                    />
                    <Button tier="sm" intent="gold" onClick={copyMyLink}>
                      {copied ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
