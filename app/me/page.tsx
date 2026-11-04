"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, usePublicClient } from "wagmi";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { useWriteContract } from "@/lib/useChainWrite";
import { BOTCHAIN_ABI } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { formatBOT, OfferData } from "@/lib/finder";
import { formatFinderError } from "@/lib/errors";

export default function MePage() {
  const { address: userAddress, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: activeBotChain.id });
  const deployment = getDeployment(activeBotChain.id);
  const { writeContractAsync, isPending } = useWriteContract();

  const [pendingBalance, setPendingBalance] = useState<bigint>(0n);
  const [lifetimeEarned, setLifetimeEarned] = useState<bigint>(0n);
  const [lifetimeFound, setLifetimeFound] = useState<number>(0);
  const [hostedOffers, setHostedOffers] = useState<OfferData[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadUserData = async () => {
    if (!publicClient || !deployment?.address || !userAddress) {
      setLoading(false);
      return;
    }

    try {
      // 1. Pending balance
      const pend = (await publicClient.readContract({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "pending",
        args: [userAddress],
      })) as bigint;
      setPendingBalance(pend);

      // 2. Lifetime stats
      const lEarned = (await publicClient.readContract({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "earned",
        args: [userAddress],
      })) as bigint;
      setLifetimeEarned(lEarned);

      const lFound = (await publicClient.readContract({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "found",
        args: [userAddress],
      })) as number;
      setLifetimeFound(lFound);

      // 3. Hosted offers
      const result = (await publicClient.readContract({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "latest",
        args: [0n, 50n],
      })) as [bigint[], any[], bigint];

      const [ids, rawOffers] = result;
      const myHosted: OfferData[] = [];
      for (let i = 0; i < ids.length; i++) {
        const o = rawOffers[i];
        if (o.seller.toLowerCase() === userAddress.toLowerCase()) {
          myHosted.push({
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
      }
      setHostedOffers(myHosted);
    } catch (e) {
      console.error("Error loading user data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
    const interval = setInterval(loadUserData, 8000);
    return () => clearInterval(interval);
  }, [deployment?.address, userAddress]);

  const handleWithdraw = async () => {
    if (!deployment?.address) return;
    setActionError(null);
    setActionSuccess(null);

    try {
      const tx = await writeContractAsync({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "withdraw",
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }

      setActionSuccess("Withdrawal successful! Transferred funds to your wallet.");
      await loadUserData();
    } catch (err) {
      setActionError(formatFinderError(err));
    }
  };

  return (
    <PageShell
      headline="Finder Dashboard & Earnings"
      lead="Pull your commissions from recommendations and view offers you manage."
      activeNav="me"
    >
      {/* Earnings Withdrawal Card */}
      <Panel styling="card" className="mb-6 border-2 border-[#264653]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase font-mono font-bold tracking-wider text-[var(--text-muted)]">
              Pending Available to Withdraw
            </span>
            <div className="text-3xl font-black font-mono mt-1 text-[#2B1D00]">
              {formatBOT(pendingBalance)}
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Includes commissions earned as a finder and sales revenue from your hosted offers.
            </p>
          </div>
          <div>
            <Button
              tier="lg"
              intent="relay"
              disabled={pendingBalance === 0n || isPending || !isConnected}
              onClick={handleWithdraw}
            >
              {isPending ? "Withdrawing..." : "Withdraw to Wallet"}
            </Button>
          </div>
        </div>
      </Panel>

      {actionError && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-mono">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 font-mono">
          {actionSuccess}
        </div>
      )}

      {/* Lifetime Finder Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Panel styling="strip">
          <span className="text-xs uppercase font-mono text-[var(--text-muted)]">
            Lifetime Finder Commission
          </span>
          <div className="text-xl font-bold font-mono text-emerald-800 mt-1">
            {formatBOT(lifetimeEarned)}
          </div>
          <span className="text-[11px] text-[var(--text-secondary)] mt-0.5 block">
            Across all offers and buyers introduced
          </span>
        </Panel>

        <Panel styling="strip">
          <span className="text-xs uppercase font-mono text-[var(--text-muted)]">
            Total Buyers Introduced
          </span>
          <div className="text-xl font-bold font-mono text-[#2B1D00] mt-1">
            {lifetimeFound} {lifetimeFound === 1 ? "buyer" : "buyers"}
          </div>
          <span className="text-[11px] text-[var(--text-secondary)] mt-0.5 block">
            Credited via your personal referral links
          </span>
        </Panel>
      </div>

      {/* Hosted Offers Table / List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-sm uppercase tracking-wider text-[#2B1D00]">
            Offers You Host ({hostedOffers.length})
          </h3>
          <Link href="/list">
            <Button tier="sm" intent="gold">
              + New Offer
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs font-mono text-[var(--text-secondary)]">
            Loading hosted offers...
          </div>
        ) : hostedOffers.length === 0 ? (
          <div className="bg-[#FFFDF5] border-2 border-dashed border-[var(--border-default)] rounded-lg p-8 text-center text-xs text-[var(--text-secondary)]">
            You haven&apos;t listed any offers yet. List an offer to start selling with word-of-mouth incentives!
          </div>
        ) : (
          <div className="space-y-3">
            {hostedOffers.map((o) => (
              <div
                key={o.id.toString()}
                className="bg-[#FFFDF5] border border-[var(--border-default)] rounded-lg p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <h4 className="font-bold text-sm text-[#2B1D00]">{o.name}</h4>
                  <p className="text-xs font-mono text-[var(--text-secondary)] mt-0.5">
                    Offer #{o.id.toString()} • Price: {formatBOT(o.price)} • Sold: {o.sold}/{o.stock}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Link href={`/offer/${o.id}`}>
                    <Button tier="sm" intent="ghost">
                      View Offer →
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
