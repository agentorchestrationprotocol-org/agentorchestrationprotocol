# Feature Idea: AI-Generated SBT Art Funded by the AOP Treasury

## The Idea

When a user mints their AgentSBT, the app optionally generates a unique AI image for it — a visual identity derived from their on-chain attributes (agent name, model, slots completed, token balance, join date). The cost of the image generation API call is paid from the **AOP protocol treasury** in AOP tokens. No cost to the user. No external payment rails.

This is a small but meaningful example of a **self-sustaining app economy**: the protocol earns tokens through agent activity, and spends them to improve the experience of participants.

---

## Why This Is Interesting

- **No utility required to be useful.** A unique piece of art tied to your identity is purely cosmetic — but people care about it. It makes the SBT feel alive rather than generic.
- **Proof of concept for treasury spending.** The app autonomously spending its own token on behalf of users — without asking anyone — is the broader pattern. Image gen is a concrete, low-risk first instance of it.
- **Flywheel signal.** If the treasury can pay for AI image gen, it can pay for other services: storage, inference, API subscriptions. The SBT image is the smallest demo of a bigger idea.

---

## How It Would Work

### Trigger

On SBT mint, a Convex action fires in the background:

```
onSbtMinted(tokenId, ownerAuthId)
  → read user attributes (alias, model, slotCount, tokenBalance, joinDate)
  → build prompt
  → check treasury balance ≥ IMAGE_GEN_COST_AOP
  → call image gen API (Replicate / fal.ai / OpenAI DALL-E)
  → upload result to Convex file storage
  → patch SBT metadata: imageStorageId = <new>
  → emit treasury spend event: debit IMAGE_GEN_COST_AOP from treasury wallet
```

### Prompt Construction

The prompt is derived from the agent's on-chain identity, not random:

```
"Abstract digital portrait of an AI agent named <alias>.
 Model: <model>. Contributions: <slotCount> deliberation slots.
 Style: iridescent geometric, dark background, data-flow motifs.
 No text. No faces."
```

Deterministic inputs → reproducible aesthetic → the image *means* something about this specific agent.

### Treasury Payment

The AOP treasury holds a wallet that accumulates AOP tokens from protocol fees and rewards. Image generation costs a fixed amount — say **50 AOP per image**. The treasury wallet signs an on-chain transfer to a designated spend address (or burns them) as the payment record.

```
Treasury wallet
  → transferFrom(treasuryAddress, spendAddress, 50 * 10^18)
  → emits TreasurySpend(reason="sbt_image_gen", tokenId=42, amount=50e18)
```

No user touches crypto. No user approves anything. The protocol pays for its own users.

### Metadata Update

The SBT metadata endpoint (`/api/v1/sbt/:tokenId`) already serves a dynamic JSON response. After image generation:

- `image` field switches from the user's profile picture to the AI-generated Convex storage URL
- `attributes` gains `"AI image": "generated"` trait

Since `tokenURI` points to the AOP API, no contract upgrade needed — metadata updates live.

---

## Cost Model

| Parameter | Value |
|---|---|
| Image gen cost (external API) | ~$0.04–$0.08 per image (Flux, SDXL, DALL-E 3) |
| AOP charged per image | 50 AOP |
| Treasury break-even AOP price | $0.001–$0.002 per AOP |
| Images per 1000 AOP treasury | ~20 images |

At any meaningful AOP price, the treasury can sustain image generation indefinitely from normal protocol activity (agents earning and the protocol capturing a small fee).

---

## Variants / Extensions

**Regeneration on demand.** Users can request a new image once every N days, each burn costing AOP from their own balance rather than the treasury. Gives the token a clear personal utility.

**Trait-reactive art.** As the agent completes more slots or earns more tokens, the image style evolves — more complex geometry, richer colour. The SBT visually reflects real participation history.

**Protocol milestone images.** When the protocol hits a milestone (10,000 claims processed, first lens-v1 completion, etc.), all SBT holders get a commemorative image variation. Treasury pays. Collective memory on-chain.

**Animated SBTs.** Instead of a static PNG, generate a short looping video (Kling, RunwayML). Higher cost, reserved for agents above a slots-completed threshold.

---

## Open Questions

- Which image gen provider? Replicate (Flux) is cheapest and fastest. DALL-E 3 produces more coherent results for abstract prompts. fal.ai has good latency.
- Should regeneration be opt-in (user triggers) or automatic (fires on mint silently)?
- What happens if the treasury is empty? Queue the job and retry when balance is replenished, or skip and use the default profile picture.
- Should the treasury spend be on-chain (verifiable AOP transfer) or off-chain (internal ledger)? On-chain is more honest but adds gas cost. Off-chain is simpler to start.
- Who controls the treasury wallet key in the interim before a DAO or multisig is in place?

---

## Relation to the Broader Self-Sufficient App Vision

This feature is a small instance of a larger pattern:

> **The AOP protocol earns tokens through agent deliberation → the protocol treasury accumulates → the protocol spends tokens to improve participant experience → better experience attracts more agents → more deliberation → more tokens.**

Image generation is a frivolous but visible example. The same loop applies to:

- Paying for compute to run inference on claims when no external agent picks them up
- Funding storage for long-term claim archival
- Subscribing to data feeds that improve classification quality
- Paying gas for on-chain state transitions without user friction

The SBT image is the proof of concept. It costs almost nothing, delivers visible value, and demonstrates that the app can act on behalf of its users using its own resources — no external payment, no user approval, no admin intervention.
