# TODO: Meta-Protocol — Self-Configuring Pipeline

## The Idea

Every claim currently enters the pipeline with a hardcoded protocol (prism-v1) and fixed slot counts. The meta-protocol is a short pre-pipeline stage that runs first and configures everything dynamically before the main protocol starts.

```
claim created
  → meta-protocol runs (1-2 agents)
      - classifies claim type
      - selects the right protocol
      - decides slot counts per layer
      - sets consensus thresholds
  → main protocol kicks off with that configuration
```

This makes the system self-configuring. No human needs to pick a protocol or decide how many slots to open.

---

## What the Meta Layer Decides

### 1. Claim type → protocol selection

| Claim type | Protocol |
|---|---|
| Factual / empirical | Prism |
| Experimental design | Lens |
| Ethical / normative | Protocol C (future) |
| Clinical / policy recommendation | Protocol D (future) |
| Open survey / synthesis | Protocol E (future) |

### 2. Slot counts per layer

Not all claims need the same depth. The meta agent reads the claim and sets slot counts based on:

- **Complexity** — a narrow technical claim needs fewer framing slots than a broad interdisciplinary one
- **Contentiousness** — highly contested claims need more deliberation and counter-evidence slots
- **Domain** — some domains (medicine, law) warrant more scrutiny than others
- **Bounty amount** — higher bounty = more slots opened = more agents compete = higher quality analysis (see below)

Example outputs:

| Claim | Framing slots | Evidence slots | Deliberation slots |
|---|---|---|---|
| Simple technical fact | 1 | 1 | 1 |
| Complex causal claim | 2 | 3 | 2 |
| Highly contested social claim | 2 | 4 | 4 |

### 3. Consensus thresholds per layer

Instead of a fixed 0.7 threshold across all layers, the meta agent can set higher thresholds for critical layers. A medical claim might require 0.85 consensus at the evidence layer.

---

## Bounty Integration

The meta-protocol is the natural place to wire in claim bounties (see `claim-bounties.md`):

```
bounty = 0           → minimum viable slot config (1-2 per layer)
bounty = $10-50      → standard slot config (2-3 per layer)
bounty = $50-200     → expanded slot config (3-5 per layer)
bounty = $200+       → maximum slot config + elevated thresholds
```

Higher bounty → meta layer opens more slots → more agents compete for the claim → better analysis → bounty poster gets more value. The economics are self-reinforcing.

---

## Architecture

The meta-protocol is itself a lightweight protocol with 1-2 layers:

- **Layer M1 (setup)** — 1 agent reads the claim, outputs a structured config: `{ protocolName, slotCounts, thresholds, domain }`
- **Layer M2 (validation, optional)** — 1 consensus agent checks the config makes sense before committing

After M2, the system initialises the main protocol with the generated config and the pipeline proceeds normally.

The meta layer output is stored on the claim so it's auditable — you can always see why a claim was routed to Lens instead of Prism, and why it got 3 evidence slots instead of 1.

---

## Why This Matters

Right now the protocol is a static template. The meta-protocol makes it adaptive. The same system can handle a narrow chemistry claim and a broad philosophical question and configure itself appropriately for each.

It also removes the burden from the claim poster — they don't need to know what a "protocol" is or how many slots to open. They just post the claim and the system figures it out.

---

## Priority

Build after:
1. Phase 1 multi-agent testnet validated (Prism v1 working at scale)
2. Protocol B (Lens) implemented
3. Claim bounties implemented (needed for the bounty → slot-count integration)

The meta-protocol is the capstone that ties Prism, Lens, and bounties together into a fully self-configuring system.
