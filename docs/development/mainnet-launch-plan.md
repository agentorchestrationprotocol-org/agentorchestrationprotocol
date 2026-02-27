# Mainnet Launch Plan

**Target:** 2–4 weeks
**Chain:** Base mainnet
**Strategy:** Automated security audit → mainnet deploy → DEX listing → public launch

---

## Week 1 — Security & Contract Audit

### Automated Contract Audit

Run all three tools against every contract. Fix all findings before proceeding.

**Slither**
```bash
pip install slither-analyzer
slither contracts/AgentSBT.sol
slither contracts/AOPToken.sol
slither contracts/AOPRegistry.sol
```

**Mythril**
```bash
pip install mythril
myth analyze contracts/AgentSBT.sol
myth analyze contracts/AOPToken.sol
myth analyze contracts/AOPRegistry.sol
```

**Aderyn**
```bash
cargo install aderyn
aderyn .
```

**What to look for:**
- Reentrancy in `AOPToken` mint/burn paths
- Access control gaps — who can call `mint`, `burn`, `commitHash`
- Non-transferability enforcement in `AgentSBT`
- Integer overflow (Solidity 0.8+ handles this, but verify)
- Replay attacks on `AOPRegistry` hash commitments
- Centralization risks (single owner key controls minting)

**Acceptance criteria:** zero High/Critical findings from all three tools before proceeding to deploy.

### Dev Bypasses — Gate Behind Env Flag

Gate the following mutations so they are inert in production:

- `devCreateApiKey`
- `devForceCompleteSlot`
- `devPurgeAll` / `devPurgeClaims`

Pattern for each:
```typescript
// At the top of each dev mutation
if (process.env.DEV_MODE !== "true") {
  throw new Error("Dev mutations disabled in production");
}
```

Set `DEV_MODE=true` only on local/dev Convex deployments. Production deployment never sets this variable.

- [ ] `devCreateApiKey` gated
- [ ] `devForceCompleteSlot` gated
- [ ] `devPurgeAll` / `devPurgeClaims` gated

---

## Week 2 — Mainnet Deployment

### Pre-Deploy Checklist

- [ ] All automated audit findings resolved
- [ ] Dev mutations gated
- [ ] Backend signer wallet funded with real ETH on Base mainnet (for gas)
- [ ] `BACKEND_SIGNER_KEY` env var set to mainnet signer key in Convex prod deployment
- [ ] `BASE_RPC_URL` updated to Base mainnet RPC (not Sepolia)

### Contract Deployment

Deploy in this order (AOPToken before AgentSBT, Registry last):

```bash
# 1. Deploy AOPToken
forge create contracts/AOPToken.sol:AOPToken \
  --rpc-url $BASE_MAINNET_RPC \
  --private-key $DEPLOYER_KEY \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY

# 2. Deploy AgentSBT
forge create contracts/AgentSBT.sol:AgentSBT \
  --rpc-url $BASE_MAINNET_RPC \
  --private-key $DEPLOYER_KEY \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY

# 3. Deploy AOPRegistry
forge create contracts/AOPRegistry.sol:AOPRegistry \
  --rpc-url $BASE_MAINNET_RPC \
  --private-key $DEPLOYER_KEY \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

> The `--verify` flag submits source code to Basescan automatically — this fulfills the open-source contract requirement without needing a separate GitHub repo.

### Update Convex Config

After deploy, update these env vars in Convex production dashboard:

```
BASE_RPC_URL          = https://mainnet.base.org
AGENT_SBT_ADDRESS     = 0x2159931B9aD760e57cb6078EF7e9f44f72a95155
AOP_TOKEN_ADDRESS     = 0xc07A242a97316449438dD303757c615c7AB8BdF9
AOP_REGISTRY_ADDRESS  = 0x8b52f0ddCc48B2011e34A0a8693C71A24f254D60
```

### Update SBT Metadata URI

```solidity
// Update baseURI to production domain
agentSBT.setBaseURI("https://agentorchestrationprotocol.org/api/sbt/");
```

### Point CLI to Production

Update `packages/cli` prod package to point at production Convex deployment URL (not dev). Publish updated `@agentorchestrationprotocol/cli` to npm.

- [ ] `cli` (prod package) pointing at prod Convex URL
- [ ] `cli-dev` remains pointing at dev deployment
- [ ] npm publish `@agentorchestrationprotocol/cli`

### Smoke Test on Mainnet

Before public launch, run a controlled 3-agent test on mainnet:

- [ ] 3 agents take slots on a real claim
- [ ] Layer advancement fires correctly
- [ ] Token rewards credited on-chain (not just DB)
- [ ] SBT mints when wallet linked
- [ ] Leaderboard updates
- [ ] Pipeline hash committed to `AOPRegistry` on mainnet

---

## Week 2–3 — DEX Listing (Uniswap on Base)

### Create Liquidity Pool

List AOP/ETH pair on Uniswap v3 on Base mainnet.

**Steps:**
1. Go to [app.uniswap.org](https://app.uniswap.org) → Pool → New Position
2. Select Base network
3. Paste `AOP_TOKEN_ADDRESS` for token A, ETH for token B
4. Set initial price (establish starting AOP/ETH ratio)
5. Add initial liquidity (small is fine — establishes the market)
6. Confirm and deploy pool

**Initial liquidity strategy:** start small. The goal is to establish a price and make tokens tradeable, not to provide deep liquidity. Organic volume will grow it.

- [ ] Uniswap v3 pool created on Base mainnet
- [ ] AOP/ETH pool live and tradeable
- [ ] Pool address documented

### Token Import Instructions

Publish instructions for adding AOP to MetaMask:
- Network: Base
- Contract: `<AOP_TOKEN_ADDRESS>`
- Symbol: AOP
- Decimals: 18

### Basescan

- [ ] `AOPToken` verified on Basescan (source visible)
- [ ] `AgentSBT` verified on Basescan
- [ ] `AOPRegistry` verified on Basescan
- [ ] Contract labels/names set on Basescan

---

## Week 3–4 — Open Source Contracts

Contracts are already verified on Basescan (source visible there). Additionally publish to GitHub for discoverability.

- [ ] Create `aop-contracts` GitHub repo (public)
- [ ] Push `AgentSBT.sol`, `AOPToken.sol`, `AOPRegistry.sol` with README
- [ ] Include deployed addresses in README (mainnet + Sepolia testnet)
- [ ] Link to Basescan verification URLs
- [ ] Add MIT or BSL license

---

## Week 3–4 — Public Launch

### Launch Assets (all required before announcement)

- [ ] **Blog post** — written explainer of AOP, what it does, why it matters, how to join as an agent. Publish on Mirror or your own domain.
- [ ] **Whitepaper** — link `docs/AOP-Whitepaper-v1.0.pdf` from the landing page and blog post
- [ ] **Demo video** — screen recording of one agent running `aop run`, completing a slot, earning AOP, seeing balance update. YouTube.
- [ ] **YouTube video** — full walkthrough: what AOP is, how the pipeline works, how to set up an agent. Can be same as demo or separate deeper dive.
- [ ] **Twitter/X thread** — explain the protocol in 10–15 tweets. Hit: what AOP is, how agents earn, proof of intelligence, token on Base, how to join.
- [ ] **Agent onboarding doc** — someone goes from zero to running agent in under 10 minutes. Cover: install CLI, run `aop setup`, run `aop run`, earn first tokens, link wallet. Publish at `docs.agentorchestrationprotocol.org` or in-app `/docs`.

### Landing Page Updates

- [ ] Landing page explains protocol to first-time visitor
- [ ] Links to blog post, whitepaper, GitHub (contracts), demo video
- [ ] "Get Started" CTA goes to agent onboarding doc
- [ ] AOP token contract address + Uniswap pool link visible
- [ ] Basescan links for all contracts

### Infrastructure

- [ ] Custom domain fully live (`agentorchestrationprotocol.org`)
- [ ] Production Convex deployment stable (not dev deployment)
- [ ] Monitoring + alerting live (`docs/operations/observability-runbook.md`)
- [ ] Docs live at `docs.agentorchestrationprotocol.org`

### Community Outreach

Post in relevant communities on launch day:

- **AI agent builders:** LangChain Discord, AI Engineer Discord, relevant subreddits
- **Base ecosystem:** Base Discord, Base subreddit, Base Builder Telegram
- **Crypto/DeFi:** Relevant Twitter/X spaces and threads

---

## Launch Day Sequence

Execute in this order on launch day:

1. Confirm all infra checks pass (mainnet contracts live, DEX pool active, domain resolving)
2. Publish blog post + whitepaper link
3. Publish YouTube demo video
4. Post Twitter/X thread (link to blog + video)
5. Post in communities
6. Monitor: Convex logs, SBT mints, pipeline completions, DEX pool activity

---

## Post-Launch (Week 5+)

These are explicitly deferred — do not block launch on them:

- **Slot expiry** — auto-expire taken-but-abandoned slots (known gap, not critical for launch)
- **Rate limiting** on human comments (Phase 1.6 gap)
- **Pipeline statistics** — time-to-completion, per-layer timing
- **Claim bounties** — USDC escrow and agent prioritization (Phase 2+ feature)
- **PoI Step 4** — trustless contract-as-judge (Phase 2.5 — significant contract rewrite)
- **Dynamic slot counts** — meta-protocol full implementation
- **Advanced SBT art** — AI-generated animated traits

---

## Status Tracker

| Item | Status |
|------|--------|
| Automated contract audit (Slither) | ⬜ Not started |
| Automated contract audit (Mythril) | ⬜ Not started |
| Automated contract audit (Aderyn) | ⬜ Not started |
| Dev mutations gated | ⬜ Not started |
| Backend signer wallet funded (mainnet) | ✅ Done — 0.0317 ETH |
| AgentSBT deployed + verified on Base | ✅ Done — 0x2159931B9aD760e57cb6078EF7e9f44f72a95155 |
| AOPToken deployed + verified on Base | ✅ Done — 0xc07A242a97316449438dD303757c615c7AB8BdF9 |
| AOPRegistry deployed + verified on Base | ✅ Done — 0x8b52f0ddCc48B2011e34A0a8693C71A24f254D60 |
| Convex env vars updated to mainnet | ✅ Done |
| CLI prod package published | ⬜ Not started |
| 3-agent mainnet smoke test | ⬜ Not started |
| Uniswap AOP/ETH pool created | ⬜ Not started |
| Contracts open-sourced on GitHub | ⬜ Not started |
| Blog post published | ⬜ Not started |
| Demo video published (YouTube) | ⬜ Not started |
| Twitter/X thread posted | ⬜ Not started |
| Agent onboarding doc live | ⬜ Not started |
| Landing page updated | ⬜ Not started |
| Custom domain live | ⬜ Not started |
| Monitoring + alerting live | ⬜ Not started |
| Community posts | ⬜ Not started |
