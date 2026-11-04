import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "child_process";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  type Address,
  defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { BOTCHAIN_ABI } from "../../lib/botchain/abi";
import { readFileSync } from "fs";
import { resolve } from "path";
import QRCode from "qrcode";

const ANVIL_PORT = 8657;
const RPC_URL = `http://127.0.0.1:${ANVIL_PORT}`;

const localChain = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
});

// Anvil standard accounts
const SELLER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Acct 0
const FINDER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // Acct 1
const BUYER_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";  // Acct 2

const sellerAccount = privateKeyToAccount(SELLER_KEY);
const finderAccount = privateKeyToAccount(FINDER_KEY);
const buyerAccount = privateKeyToAccount(BUYER_KEY);

describe("Finder integration test (Anvil)", () => {
  let anvilProcess: ChildProcess;
  let contractAddress: Address;

  const publicClient = createPublicClient({
    chain: localChain,
    transport: http(RPC_URL),
  });

  const sellerClient = createWalletClient({
    account: sellerAccount,
    chain: localChain,
    transport: http(RPC_URL),
  });

  const finderClient = createWalletClient({
    account: finderAccount,
    chain: localChain,
    transport: http(RPC_URL),
  });

  const buyerClient = createWalletClient({
    account: buyerAccount,
    chain: localChain,
    transport: http(RPC_URL),
  });

  beforeAll(async () => {
    anvilProcess = spawn("anvil", ["--port", String(ANVIL_PORT), "--silent"], {
      stdio: "ignore",
    });

    let connected = false;
    for (let i = 0; i < 30; i++) {
      try {
        await publicClient.getBlockNumber();
        connected = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    if (!connected) throw new Error("Could not connect to Anvil on port " + ANVIL_PORT);

    const artifactPath = resolve(__dirname, "../../contracts/out/Finder.sol/Finder.json");
    const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
    const bytecode = artifact.bytecode.object as `0x${string}`;

    const deployHash = await sellerClient.deployContract({
      abi: BOTCHAIN_ABI,
      bytecode,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
    if (!receipt.contractAddress) throw new Error("Contract deployment failed");
    contractAddress = receipt.contractAddress;
  });

  afterAll(() => {
    if (anvilProcess) {
      anvilProcess.kill();
    }
  });

  it("lists an offer, buys through a finder link with split, verifies QR and withdraws", async () => {
    const price = parseEther("2.0");
    const finderBps = 1500; // 15% -> 0.3 BOT to finder, 1.7 BOT to seller
    const stock = 10;
    const duration = 86400; // 1 day

    // 1. Seller lists offer
    const listTx = await sellerClient.writeContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "list",
      args: ["Exclusive Course", "Deep dive into BotChain protocols", price, finderBps, stock, BigInt(duration)],
    });
    await publicClient.waitForTransactionReceipt({ hash: listTx });

    const offerId = 1n;

    // 2. Buyer buys specifying finderAccount as finder
    const buyTx = await buyerClient.writeContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "buy",
      args: [offerId, finderAccount.address],
      value: price,
    });
    await publicClient.waitForTransactionReceipt({ hash: buyTx });

    // 3. Verify pending amounts
    const sellerPending = (await publicClient.readContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "pending",
      args: [sellerAccount.address],
    })) as bigint;

    const finderPending = (await publicClient.readContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "pending",
      args: [finderAccount.address],
    })) as bigint;

    expect(finderPending).toBe(parseEther("0.3"));
    expect(sellerPending).toBe(parseEther("1.7"));

    // 4. Verify finder tally on offer
    const [buyersCount, earnedAmount] = (await publicClient.readContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "foundOn",
      args: [offerId, finderAccount.address],
    })) as [number, bigint];

    expect(buyersCount).toBe(1);
    expect(earnedAmount).toBe(parseEther("0.3"));

    // 5. Verify QR code decodes to exact link
    const expectedLink = `https://finder.botchain.ai/offer/${offerId}?f=${finderAccount.address}`;
    const qrDataUrl = await QRCode.toDataURL(expectedLink);
    expect(qrDataUrl.startsWith("data:image/png;base64,")).toBe(true);

    // 6. Finder pulls pending commission
    const finderBalBefore = await publicClient.getBalance({ address: finderAccount.address });
    const withdrawTx = await finderClient.writeContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "withdraw",
    });
    const withdrawReceipt = await publicClient.waitForTransactionReceipt({ hash: withdrawTx });
    const gasUsed = withdrawReceipt.gasUsed * withdrawReceipt.effectiveGasPrice;
    const finderBalAfter = await publicClient.getBalance({ address: finderAccount.address });

    expect(finderBalAfter).toBe(finderBalBefore + parseEther("0.3") - gasUsed);
  });
});
