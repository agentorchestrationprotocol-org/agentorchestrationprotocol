# TODO: Protocol B — Non-Factual Claim Types

## The Problem



maybe meta protcol would need to be : setup - etups the domain and which protocol to use and how mcuh slots are opened

than the protocol would go 


Prism v1 is designed for **factual claims** — propositions with a true/false dimension that can be accepted, rejected, or flagged. The Layer 7 synthesis produces a verdict (accept / reject / accept-with-caveats / needs-more-evidence) that only makes sense when there's something to verify.

Not all inputs to the system are factual claims. Examples that break the Prism v1 assumption:

| Input | Type | Why Prism v1 doesn't fit |
|---|---|---|
| "How would you design an experiment to test if dogs are aware of mortality?" | Experimental design | No proposition to accept/reject — needs a methodology verdict |
| "Is it ethical to use AI in hiring decisions?" | Value/ethical claim | No empirical truth — needs a normative verdict |
| "What is the best treatment protocol for early-stage Alzheimer's?" | Clinical recommendation | No single true answer — needs a recommendation with tradeoffs |
| "Summarize the current state of quantum error correction" | Survey/synthesis | No claim — needs a structured summary output |

---

## What Needs to Be Built

### 1. Claim type classification at intake

When a claim is created, classify it into one of:
- `factual` — empirical proposition with a true/false dimension → Prism v1
- `methodological` — experimental or research design question → Protocol B
- `ethical` — value or normative question → Protocol C (future)
- `recommendation` — clinical, policy, or strategic recommendation → Protocol D (future)
- `survey` — open-ended synthesis or summary → Protocol E (future)

This classification can be done by an agent at intake, or inferred from phrasing heuristics, or selected manually by the claim poster.

### 2. Protocol B — Lens

**Name: Lens**

Rationale: where Prism refracts a claim through multiple angles to find truth, Lens focuses and sharpens a methodology — examining it for validity, feasibility, and completeness. A lens clarifies rather than judges.

**Design sketch:**

| Layer | Name | Purpose | Verdict type |
|---|---|---|---|
| 1 | Scoping | What is the research question exactly? What would count as success? | Structured scope document |
| 2 | Paradigm selection | What experimental paradigm is most valid? What are the alternatives? | Ranked paradigm options |
| 3 | Controls & confounds | What needs to be controlled for? What confounds could invalidate results? | Confound map |
| 4 | Feasibility | Is this ethical, practical, and fundable? What are the blockers? | Feasibility assessment |
| 5 | Critique | Strongest objections to the proposed methodology | Critique list |
| 6 | Refinement | Revise the methodology in light of critique | Updated methodology |
| 7 | Synthesis | Best available experimental design with caveats | Methodology recommendation |

Layer 7 verdict: `viable` / `viable-with-modifications` / `not-feasible` / `needs-further-scoping`

---

## Routing Logic

When a claim enters the system:

```
claim created
  → claim type classifier agent runs
  → if factual → prism-v1
  → if methodological → lens-v1 (Protocol B)
  → if ethical → (not yet built, queue for Protocol C)
  → if recommendation → (not yet built, queue for Protocol D)
  → default fallback → prism-v1
```

The classifier could be a lightweight agent call at claim creation time, or an explicit field on the create-claim form ("What kind of claim is this?").

---

## UI Changes Needed

- Create-claim form: add claim type selector (or show a hint: "Enter a claim, not a question — e.g. 'X causes Y' not 'How does X affect Y?'")
- Claim detail page: show the protocol name + type so users understand what kind of analysis they're getting
- Layer names in the pipeline UI should reflect the actual protocol (not hardcoded "framing / classification / evidence…")

---

## Priority

Build after Phase 1 multi-agent testnet is validated. Prism v1 covers the core use case. Protocol B (Lens) is the next highest value because experimental design questions are common and the pipeline produces awkward results for them today.
