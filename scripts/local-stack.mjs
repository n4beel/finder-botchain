import { spawn } from "child_process";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ANVIL_PORT = 8757;
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
const FINDER_KEYS = [
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // F1 (Acct 1)
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // F2 (Acct 2)
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // F3 (Acct 3)
];
const BUYER_KEYS = [
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // Buyer A (Acct 4)
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba", // Buyer B (Acct 5)
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e", // Buyer C (Acct 6)
  "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356", // Buyer D (Acct 7)
  "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97", // Buyer E (Acct 8)
];

async function main() {
  console.log(`Starting Anvil on port ${ANVIL_PORT}...`);
  const anvil = spawn("anvil", ["--port", String(ANVIL_PORT), "--silent"], {
    stdio: "inherit",
  });

  process.on("SIGINT", () => {
    anvil.kill();
    process.exit();
  });
  process.on("SIGTERM", () => {
    anvil.kill();
    process.exit();
  });

  const publicClient = createPublicClient({
    chain: localChain,
    transport: http(RPC_URL),
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
  if (!connected) throw new Error("Could not connect to Anvil");

  const sellerAccount = privateKeyToAccount(SELLER_KEY);
  const sellerClient = createWalletClient({
    account: sellerAccount,
    chain: localChain,
    transport: http(RPC_URL),
  });

  const artifactPath = resolve(__dirname, "../contracts/out/Finder.sol/Finder.json");
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  const abi = artifact.abi;
  const bytecode = artifact.bytecode.object as `0x${string}`;

  console.log("Deploying Finder contract...");
  const deployHash = await sellerClient.deployContract({
    abi,
    bytecode,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  const contractAddress = receipt.contractAddress!;
  console.log(`Finder deployed at: ${contractAddress}`);

  // Write .env.local
  const envContent = [
    `NEXT_PUBLIC_CONTRACT_31337=${contractAddress}`,
    `NEXT_PUBLIC_DEPLOY_BLOCK_31337=${receipt.blockNumber}`,
    `NEXT_PUBLIC_CHAIN_ID=31337`,
    `NEXT_PUBLIC_RPC_URL=${RPC_URL}`,
  ].join("\n");
  writeFileSync(resolve(__dirname, "../.env.local"), envContent + "\n");
  console.log("Wrote .env.local");

  // SEED DATA per 57-finder.md §5:
  // - Offer 1: open with five buyers through three different finders and one without
  // - Offer 2: sold out
  // - Offer 3: ended
  // - Offer 4: with a 30% cut
  // - Offer 5: new
  console.log("Seeding offers...");

  // Offer 1: 1 BOT, 10% (1000 bps), stock 20
  const o1Tx = await sellerClient.writeContract({
    address: contractAddress,
    abi,
    functionName: "list",
    args: ["Community Workshop", "Mastering full stack development", parseEther("1.0"), 1000, 20, 86400n * 30n],
  });
  await publicClient.waitForTransactionReceipt({ hash: o1Tx });

  // 5 buyers:
  // Buyer A via F1
  // Buyer B via F1
  // Buyer C via F2
  // Buyer D via F3
  // Buyer E without finder
  const finders = FINDER_KEYS.map((k) => privateKeyToAccount(k as `0x${string}`).address);
  const buyers = BUYER_KEYS.map((k) => {
    const acct = privateKeyToAccount(k as `0x${string}`);
    return createWalletClient({ account: acct, chain: localChain, transport: http(RPC_URL) });
  });

  const b1 = await buyers[0].writeContract({ address: contractAddress, abi, functionName: "buy", args: [1n, finders[0]], value: parseEther("1.0") });
  await publicClient.waitForTransactionReceipt({ hash: b1 });
  const b2 = await buyers[1].writeContract({ address: contractAddress, abi, functionName: "buy", args: [1n, finders[0]], value: parseEther("1.0") });
  await publicClient.waitForTransactionReceipt({ hash: b2 });
  const b3 = await buyers[2].writeContract({ address: contractAddress, abi, functionName: "buy", args: [1n, finders[1]], value: parseEther("1.0") });
  await publicClient.waitForTransactionReceipt({ hash: b3 });
  const b4 = await buyers[3].writeContract({ address: contractAddress, abi, functionName: "buy", args: [1n, finders[2]], value: parseEther("1.0") });
  await publicClient.waitForTransactionReceipt({ hash: b4 });
  const b5 = await buyers[4].writeContract({ address: contractAddress, abi, functionName: "buy", args: [1n, "0x0000000000000000000000000000000000000000"], value: parseEther("1.0") });
  await publicClient.waitForTransactionReceipt({ hash: b5 });

  // Offer 2: Sold out (stock 1)
  const o2Tx = await sellerClient.writeContract({
    address: contractAddress,
    abi,
    functionName: "list",
    args: ["Vintage Camera", "Restored mechanical 35mm rangefinder", parseEther("2.5"), 1500, 1, 86400n * 7n],
  });
  await publicClient.waitForTransactionReceipt({ hash: o2Tx });
  const buySoldOut = await buyers[0].writeContract({ address: contractAddress, abi, functionName: "buy", args: [2n, finders[0]], value: parseEther("2.5") });
  await publicClient.waitForTransactionReceipt({ hash: buySoldOut });

  // Offer 3: Ended (short duration 3600s, then we will not warp anvil globally, but duration is minimal)
  const o3Tx = await sellerClient.writeContract({
    address: contractAddress,
    abi,
    functionName: "list",
    args: ["Flash Concert Ticket", "Admit one for tonight", parseEther("0.5"), 500, 5, 3600n],
  });
  await publicClient.waitForTransactionReceipt({ hash: o3Tx });

  // Offer 4: 30% cut (3000 bps)
  const o4Tx = await sellerClient.writeContract({
    address: contractAddress,
    abi,
    functionName: "list",
    args: ["Enterprise Consultation", "High touch strategic advisory", parseEther("5.0"), 3000, 10, 86400n * 60n],
  });
  await publicClient.waitForTransactionReceipt({ hash: o4Tx });

  // Offer 5: New offer
  const o5Tx = await sellerClient.writeContract({
    address: contractAddress,
    abi,
    functionName: "list",
    args: ["Hardware Prototype", "Next gen development kit", parseEther("0.75"), 2000, 50, 86400n * 14n],
  });
  await publicClient.waitForTransactionReceipt({ hash: o5Tx });

  console.log("Local stack ready! Running indefinitely. Press Ctrl+C to exit.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
