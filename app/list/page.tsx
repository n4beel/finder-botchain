"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { parseEther } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useWriteContract } from "@/lib/useChainWrite";
import { BOTCHAIN_ABI } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { formatFinderError } from "@/lib/errors";
import {
  MAX_NAME_BYTES,
  MAX_DESC_BYTES,
  MIN_PRICE,
  MAX_PRICE,
  MIN_BPS,
  MAX_BPS,
  MAX_STOCK,
  MIN_DURATION,
  MAX_DURATION,
} from "@/lib/finder";

export default function ListOfferPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: activeBotChain.id });
  const deployment = getDeployment(activeBotChain.id);
  const { writeContractAsync, isPending } = useWriteContract();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("1.0");
  const [finderPct, setFinderPct] = useState("10"); // 10%
  const [stock, setStock] = useState("10");
  const [durationDays, setDurationDays] = useState("30");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isConnected) {
      setError("Please connect your wallet first.");
      return;
    }

    if (!name.trim()) {
      setError("Please enter an offer name.");
      return;
    }

    const nameBytes = new TextEncoder().encode(name.trim()).length;
    if (nameBytes > MAX_NAME_BYTES) {
      setError(`Name too long (${nameBytes}/${MAX_NAME_BYTES} bytes).`);
      return;
    }

    if (!description.trim()) {
      setError("Please enter an offer description.");
      return;
    }

    const descBytes = new TextEncoder().encode(description.trim()).length;
    if (descBytes > MAX_DESC_BYTES) {
      setError(`Description too long (${descBytes}/${MAX_DESC_BYTES} bytes).`);
      return;
    }

    let parsedPrice = 0n;
    try {
      parsedPrice = parseEther(price);
      if (parsedPrice < MIN_PRICE || parsedPrice > MAX_PRICE) {
        setError("Price must be between 0.001 and 1,000,000 BOT.");
        return;
      }
    } catch {
      setError("Invalid price format.");
      return;
    }

    const numPct = Number(finderPct);
    const bps = Math.round(numPct * 100);
    if (bps < MIN_BPS || bps > MAX_BPS) {
      setError("Finder cut must be between 1% and 30%.");
      return;
    }

    const numStock = Number(stock);
    if (!numStock || numStock < 1 || numStock > MAX_STOCK) {
      setError("Stock must be between 1 and 10,000 units.");
      return;
    }

    const numDurationSecs = BigInt(Math.round(Number(durationDays) * 86400));
    if (numDurationSecs < BigInt(MIN_DURATION) || numDurationSecs > BigInt(MAX_DURATION)) {
      setError("Duration must be between 1 hour and 365 days.");
      return;
    }

    if (!deployment?.address) {
      setError("Contract not deployed on this network.");
      return;
    }

    try {
      const tx = await writeContractAsync({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "list",
        args: [name.trim(), description.trim(), parsedPrice, bps, numStock, numDurationSecs],
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }

      router.push("/");
    } catch (err) {
      setError(formatFinderError(err));
    }
  };

  const nameLen = new TextEncoder().encode(name).length;
  const descLen = new TextEncoder().encode(description).length;

  return (
    <PageShell
      headline="List a New Offer"
      lead="Set the price and assign a finder commission (1–30%) to incentivize word-of-mouth sales."
      activeNav="list"
    >
      <div className="max-w-xl mx-auto">
        <Panel styling="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-[var(--text-secondary)] mb-1">
                Offer Title
              </label>
              <Input
                type="text"
                placeholder="e.g. Masterclass Workshop Pass"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                maxLength={64}
                required
              />
              <p className="text-[11px] text-[var(--text-muted)] font-mono mt-1">
                Max 64 bytes ({nameLen}/{MAX_NAME_BYTES} bytes)
              </p>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase text-[var(--text-secondary)] mb-1">
                Description (Recorded in Listed Log)
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 rounded border border-[var(--border-default)] bg-white text-xs font-sans focus:outline-none focus:ring-1 focus:ring-[#264653]"
                placeholder="Detailed description of what the buyer receives..."
                value={description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                maxLength={300}
                required
              />
              <p className="text-[11px] text-[var(--text-muted)] font-mono mt-1">
                Max 300 bytes ({descLen}/{MAX_DESC_BYTES} bytes)
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono font-bold uppercase text-[var(--text-secondary)] mb-1">
                  Price (BOT)
                </label>
                <Input
                  type="number"
                  step="any"
                  min="0.001"
                  placeholder="1.0"
                  value={price}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold uppercase text-[var(--text-secondary)] mb-1">
                  Finder Cut (1% – 30%)
                </label>
                <Input
                  type="number"
                  step="any"
                  min="1"
                  max="30"
                  placeholder="10"
                  value={finderPct}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFinderPct(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono font-bold uppercase text-[var(--text-secondary)] mb-1">
                  Available Stock
                </label>
                <Input
                  type="number"
                  step="any"
                  min="1"
                  max="10000"
                  placeholder="10"
                  value={stock}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStock(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold uppercase text-[var(--text-secondary)] mb-1">
                  Duration (Days)
                </label>
                <Input
                  type="number"
                  step="any"
                  min="1"
                  max="365"
                  placeholder="30"
                  value={durationDays}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDurationDays(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <Button
                type="button"
                intent="ghost"
                onClick={() => router.push("/")}
              >
                Cancel
              </Button>
              <Button type="submit" busy={isPending}>
                {isPending ? "Listing Offer..." : "Publish Relay Offer"}
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </PageShell>
  );
}
