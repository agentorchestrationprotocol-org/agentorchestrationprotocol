"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { createWalletClient, createPublicClient, getAddress, http, parseEther, keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, base } from "viem/chains";

// ABI fragments — only what we need
const AGENT_SBT_ABI = [
  {
    name: "mint",
    type: "function",
    inputs: [{ name: "to", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

const AOP_TOKEN_ABI = [
  {
    name: "mint",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const WEI_PER_AOP = BigInt(10) ** BigInt(18);
const TRANSFER_EVENT_TOPIC = keccak256(toBytes("Transfer(address,address,uint256)"));
const DEFAULT_STAKE_TOPUP_SINK = "0x000000000000000000000000000000000000dEaD";

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

function getChainContext() {
  const rpcUrl = process.env.BASE_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;
  if (!rpcUrl) {
    throw new Error("Missing env var: BASE_RPC_URL or BASE_SEPOLIA_RPC_URL");
  }
  const isMainnet = !!process.env.BASE_RPC_URL;
  return {
    rpcUrl,
    chain: isMainnet ? base : baseSepolia,
    chainId: isMainnet ? 8453 : 84532,
  };
}

export function getStakeTopupSinkAddress(): `0x${string}` {
  return getAddress(
    (process.env.AOP_STAKE_TOPUP_ADDRESS || DEFAULT_STAKE_TOPUP_SINK).trim()
  ) as `0x${string}`;
}

/**
 * Mint one SBT to the given wallet address.
 * Returns the on-chain tokenId.
 */
export const mintSBT = internalAction({
  args: { walletAddress: v.string() },
  handler: async (_ctx, args): Promise<number> => {
    const { rpcUrl, chain } = getChainContext();
    const contractAddress = getEnv("AGENT_SBT_ADDRESS") as `0x${string}`;
    const privateKey = getEnv("BACKEND_SIGNER_KEY") as `0x${string}`;

    const account = privateKeyToAccount(privateKey);
    const transport = http(rpcUrl);

    const publicClient = createPublicClient({ chain, transport });
    const walletClient = createWalletClient({ account, chain, transport });

    const { request } = await publicClient.simulateContract({
      address: contractAddress,
      abi: AGENT_SBT_ABI,
      functionName: "mint",
      args: [args.walletAddress as `0x${string}`],
      account,
    });

    const txHash = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Extract tokenId from the Minted event log
    // event Minted(address indexed to, uint256 indexed tokenId)
    const mintedLog = receipt.logs.find((log) => log.topics.length === 3);
    if (!mintedLog) throw new Error("Minted event not found in receipt");
    const tokenId = parseInt(mintedLog.topics[2]!, 16);

    return tokenId;
  },
});

/**
 * Mint AOP tokens to a wallet address (called when agent claims their balance).
 */
export const mintTokens = internalAction({
  args: {
    walletAddress: v.string(),
    amount: v.number(), // in whole AOP tokens (will be multiplied by 1e18)
  },
  handler: async (_ctx, args): Promise<string> => {
    const { rpcUrl, chain } = getChainContext();
    const contractAddress = getEnv("AOP_TOKEN_ADDRESS") as `0x${string}`;
    const privateKey = getEnv("BACKEND_SIGNER_KEY") as `0x${string}`;

    const account = privateKeyToAccount(privateKey);
    const transport = http(rpcUrl);

    const publicClient = createPublicClient({ chain, transport });
    const walletClient = createWalletClient({ account, chain, transport });

    const { request } = await publicClient.simulateContract({
      address: contractAddress,
      abi: AOP_TOKEN_ABI,
      functionName: "mint",
      args: [
        args.walletAddress as `0x${string}`,
        parseEther(String(args.amount)),
      ],
      account,
    });

    const txHash = await walletClient.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    return txHash;
  },
});

/**
 * Reads wallet AOP token balance from chain.
 * Returns both wei and whole-token (floored) units.
 */
export const readAopTokenBalance = internalAction({
  args: { walletAddress: v.string() },
  handler: async (_ctx, args): Promise<{ balanceWei: string; balanceWhole: number; chainId: number }> => {
    const { rpcUrl, chain, chainId } = getChainContext();
    const contractAddress = getEnv("AOP_TOKEN_ADDRESS") as `0x${string}`;
    const walletAddress = getAddress(args.walletAddress) as `0x${string}`;

    const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
    const balanceWei = await publicClient.readContract({
      address: contractAddress,
      abi: AOP_TOKEN_ABI,
      functionName: "balanceOf",
      args: [walletAddress],
    });

    const balanceWholeBig = balanceWei / WEI_PER_AOP;
    const balanceWhole = Number(balanceWholeBig);
    if (!Number.isSafeInteger(balanceWhole)) {
      throw new Error("Wallet balance is too large to represent safely");
    }

    return {
      balanceWei: balanceWei.toString(),
      balanceWhole,
      chainId,
    };
  },
});

/**
 * Verifies an on-chain AOP transfer from `fromAddress` to `toAddress` in the
 * supplied transaction hash, then returns the transferred whole-token amount.
 */
export const verifyStakeTopupTransfer = internalAction({
  args: {
    txHash: v.string(),
    fromAddress: v.string(),
    toAddress: v.string(),
  },
  handler: async (
    _ctx,
    args
  ): Promise<{
    txHash: string;
    tokenAddress: string;
    chainId: number;
    fromAddress: string;
    toAddress: string;
    amount: number;
    amountWei: string;
    blockNumber: string;
  }> => {
    if (!/^0x[0-9a-fA-F]{64}$/.test(args.txHash)) {
      throw new Error("Invalid transaction hash");
    }

    const { rpcUrl, chain, chainId } = getChainContext();
    const tokenAddress = getAddress(getEnv("AOP_TOKEN_ADDRESS")) as `0x${string}`;
    const fromAddress = getAddress(args.fromAddress) as `0x${string}`;
    const toAddress = getAddress(args.toAddress) as `0x${string}`;
    const txHash = args.txHash.toLowerCase();

    const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
      confirmations: 1,
      timeout: 600_000,
    });

    if (receipt.status !== "success") {
      throw new Error("Top-up transaction failed on-chain");
    }

    let matchedAmountWei = BigInt(0);
    const tokenAddressLower = tokenAddress.toLowerCase();
    const expectedFromLower = fromAddress.toLowerCase();
    const expectedToLower = toAddress.toLowerCase();

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== tokenAddressLower) continue;
      const [topic0, topic1, topic2] = log.topics;
      if (!topic0 || !topic1 || !topic2) continue;
      if (topic0.toLowerCase() !== TRANSFER_EVENT_TOPIC.toLowerCase()) continue;

      // Topics store 32-byte values; the address is the last 20 bytes.
      const fromTopicAddress = getAddress(`0x${topic1.slice(-40)}`).toLowerCase();
      const toTopicAddress = getAddress(`0x${topic2.slice(-40)}`).toLowerCase();
      if (fromTopicAddress !== expectedFromLower || toTopicAddress !== expectedToLower) continue;
      if (!log.data || log.data === "0x") continue;

      matchedAmountWei += BigInt(log.data);
    }

    if (matchedAmountWei <= BigInt(0)) {
      throw new Error("Top-up transfer to protocol sink not found in transaction");
    }
    if (matchedAmountWei % WEI_PER_AOP !== BigInt(0)) {
      throw new Error("Top-up amount must be a whole AOP value");
    }

    const amountBig = matchedAmountWei / WEI_PER_AOP;
    const amount = Number(amountBig);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error("Invalid top-up amount");
    }

    return {
      txHash,
      tokenAddress,
      chainId,
      fromAddress,
      toAddress,
      amount,
      amountWei: matchedAmountWei.toString(),
      blockNumber: receipt.blockNumber.toString(),
    };
  },
});

const AOP_REGISTRY_ABI = [
  {
    name: "commitPipelineHash",
    type: "function",
    inputs: [
      { name: "claimId",    type: "bytes32" },
      { name: "outputHash", type: "bytes32" },
      { name: "agentCount", type: "uint32"  },
      { name: "layerCount", type: "uint32"  },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

/**
 * Commit a completed pipeline's output hash to the AOPRegistry contract.
 * claimIdStr  — the raw Convex claim ID string (will be keccak256'd on-chain input)
 * outputHash  — hex string of the keccak256 hash of all slot outputs
 * agentCount  — number of distinct agents who participated
 * layerCount  — number of layers the pipeline ran
 */
export const commitPipelineHash = internalAction({
  args: {
    claimIdStr:  v.string(),
    outputHash:  v.string(), // "0x" + 64 hex chars
    agentCount:  v.number(),
    layerCount:  v.number(),
  },
  handler: async (_ctx, args): Promise<string> => {
    const registryAddress = process.env.AOP_REGISTRY_ADDRESS;
    if (!registryAddress) {
      // Registry not deployed yet — skip silently (testnet / dev without registry)
      return "skipped";
    }

    const { rpcUrl, chain } = getChainContext();
    const privateKey = getEnv("BACKEND_SIGNER_KEY") as `0x${string}`;

    const account = privateKeyToAccount(privateKey);
    const transport = http(rpcUrl);
    const publicClient  = createPublicClient({ chain, transport });
    const walletClient  = createWalletClient({ account, chain, transport });

    // Convert Convex claim ID string to bytes32 via keccak256
    const claimIdBytes32 = keccak256(toBytes(args.claimIdStr));

    const { request } = await publicClient.simulateContract({
      address: registryAddress as `0x${string}`,
      abi: AOP_REGISTRY_ABI,
      functionName: "commitPipelineHash",
      args: [
        claimIdBytes32,
        args.outputHash as `0x${string}`,
        args.agentCount,
        args.layerCount,
      ],
      account,
    });

    const txHash = await walletClient.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    return txHash;
  },
});
