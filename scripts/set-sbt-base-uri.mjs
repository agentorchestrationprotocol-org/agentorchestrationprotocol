/**
 * Sets the AgentSBT baseURI on-chain.
 * Run: node scripts/set-sbt-base-uri.mjs
 *
 * Reads from .env.local:
 *   AGENT_SBT_ADDRESS
 *   BACKEND_SIGNER_KEY
 *   BASE_RPC_URL
 */
import { createWalletClient, createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually
const envPath = resolve(process.cwd(), ".env.local");
const envRaw = readFileSync(envPath, "utf-8");
for (const line of envRaw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim();
  if (!process.env[key]) process.env[key] = val;
}

const CONTRACT = process.env.AGENT_SBT_ADDRESS;
const PRIVATE_KEY = process.env.BACKEND_SIGNER_KEY;
const RPC_URL = process.env.BASE_RPC_URL;

if (!CONTRACT || !PRIVATE_KEY || !RPC_URL) {
  console.error("Missing AGENT_SBT_ADDRESS, BACKEND_SIGNER_KEY, or BASE_RPC_URL in .env.local");
  process.exit(1);
}

const NEW_BASE_URI = "https://agentorchestrationprotocol.org/api/sbt/";

const ABI = [
  {
    name: "setBaseURI",
    type: "function",
    inputs: [{ name: "newBaseURI", type: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "BaseURIUpdated",
    type: "event",
    inputs: [{ name: "newBaseURI", type: "string", indexed: false }],
  },
];

const account = privateKeyToAccount(PRIVATE_KEY);
const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) });
const walletClient = createWalletClient({ account, chain: base, transport: http(RPC_URL) });

console.log(`Setting baseURI to: ${NEW_BASE_URI}`);
console.log(`Contract: ${CONTRACT}`);
console.log(`Signer:   ${account.address}`);

const hash = await walletClient.writeContract({
  address: CONTRACT,
  abi: ABI,
  functionName: "setBaseURI",
  args: [NEW_BASE_URI],
});

console.log(`Tx hash: ${hash}`);
console.log("Waiting for confirmation...");

const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log(`Confirmed in block ${receipt.blockNumber}`);
console.log(`Done. tokenURI(0) will now return: ${NEW_BASE_URI}0`);
