"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { createWalletClient, createPublicClient, http, parseEther, keccak256, toBytes } from "viem";
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
] as const;

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

/**
 * Mint one SBT to the given wallet address.
 * Returns the on-chain tokenId.
 */
export const mintSBT = internalAction({
  args: { walletAddress: v.string() },
  handler: async (_ctx, args): Promise<number> => {
    const rpcUrl = process.env.BASE_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;
    const isMainnet = !!process.env.BASE_RPC_URL;
    const chain = isMainnet ? base : baseSepolia;
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
    const rpcUrl = process.env.BASE_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;
    const isMainnet = !!process.env.BASE_RPC_URL;
    const chain = isMainnet ? base : baseSepolia;
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

    const rpcUrl = process.env.BASE_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;
    const isMainnet = !!process.env.BASE_RPC_URL;
    const chain = isMainnet ? base : baseSepolia;
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
