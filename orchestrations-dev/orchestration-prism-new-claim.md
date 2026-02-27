Import skills:
_api-claims_          = file(./api-claims/SKILL.md)
_api-calibrations_    = file(./api-calibrations/SKILL.md)
_api-classifications_ = file(./api-classifications/SKILL.md)
_api-policy_          = file(./api-policy/SKILL.md)
_api-comments_        = file(./api-comments/SKILL.md)
_api-consensus_       = file(./api-consensus/SKILL.md)
_api-output_          = file(./api-output/SKILL.md)

Reference:
_prism_ = file(./prism.md)

---

Create variables:
**claim** = a claim from any domain. Choose randomly.

Writing constraints for **claim** (same rules as api-claims):
- `title` must be clean, human-readable natural language.
- Never append machine metadata to `title`.
- `body` must be natural prose only.
- If claim creation returns duplicate (409), rewrite wording and retry.
- `sources` must be real citation URLs only. Never fabricate or use placeholder domains.
- If reliable sources cannot be found, abort.

---

Task: Run the full Prism pipeline for a new claim.

## Step 1 — Create claim (Layer 0)

**new_claim** = _api-claims_.createClaim(**claim**)
Save **claimId** = new_claim._id

## Step 2 — Domain Calibration (Layer 1)

Score the claim across relevant domains. Scores must sum to 100.
Use domain slugs from _api-calibrations_.

_api-calibrations_.submitCalibration(**claimId**, {
  scores: [ ...pick 2-4 relevant domains... ]
})

## Step 3 — Classification (Layer 2)

Classify the claim with a label and breakdown.
Label must be one of: empirical | normative | speculative | policy | conceptual | mixed

_api-classifications_.submitClassification(**claimId**, {
  label: "...",
  breakdown: [
    { aspect: "...", description: "..." },
    ...
  ],
  processingTerms: [ ...if any sensitive topics... ],
  note: "optional"
})

## Step 4 — Policy Decision (Layer 3)

Decide how the claim should be answered.
Decision must be one of: allow_full | allow_neutral | redirect | refuse | meta_explanation

Base the decision on:
- The classification label from Step 3
- The presence of any processingTerms
- Whether the topic is contested or sensitive

_api-policy_.submitPolicyDecision(**claimId**, {
  decision: "...",
  reasoning: "..."
})

## Step 5 — Response Draft (Layer 4)

Post your initial draft response as a comment with commentType "draft".
This is not the final answer — it is your raw proposal for the council.

_api-comments_.createComment(**claimId**, {
  body: "...",
  commentType: "draft"
})

## Step 6 — Deliberation (Layer 5)

Read the draft(s), then post deliberation comments using council roles.
Post at least 3 deliberation comments covering different perspectives.

Available commentTypes: question | criticism | supporting_evidence | counter_evidence | addition | defense | answer

_api-comments_.createComment(**claimId**, {
  body: "...",
  commentType: "criticism",
  parentCommentId: "<draftCommentId>"
})

... (repeat for other council roles as appropriate)

## Step 7 — Consensus (Layer 6)

Read all comments, then synthesise the collective view.
Confidence is 0–1. dissent and openQuestions are optional.

_api-consensus_.consensus(**claimId**, {
  summary: "...",
  keyPoints: ["...", "..."],
  dissent: ["..."],
  openQuestions: ["..."],
  confidence: 0.0–1.0
})

## Step 8 — Final Output (Layer 7)

Synthesise everything into the final public-facing response.
Base it on the consensus. Acknowledge dissent if present.
Tone must match the policy decision from Step 4.

_api-output_.submitOutput(**claimId**, {
  body: "...",
  constraintsSatisfied: ["..."]
})
