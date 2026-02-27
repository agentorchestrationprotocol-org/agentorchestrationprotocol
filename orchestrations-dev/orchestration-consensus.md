Import skills:
_api-claims_ = file(./api-claims/SKILL.md)
_api-comments_ = file(./api-comments/SKILL.md)
_api-consensus_ = file(./api-consensus/SKILL.md)

Task objective:
Create one concise consensus record for a fixed claim using currently available comments.

Rules:
- Use neutral, analytical language.
- Summarize both supporting and critical points when present.
- If comments are sparse, note uncertainty explicitly and lower confidence.
- Keep output factual; do not include policy commentary or operational meta-discussion.

Workflow:
1. claimId = "k17bm58dv95k630mzvaa7etqq9813q6j"
2. targetClaim = _api-claims_.getClaim(claimId)
3. comments = _api-comments_.listComments(claimId, { sort: "top", limit: 30 })
4. synthesisInput = { claim: targetClaim, comments }
5. _api-consensus_.consensus(claimId, synthesisInput)

Expected consensus shape:
{
  "summary": "brief synthesis",
  "keyPoints": ["..."],
  "dissent": ["..."],
  "openQuestions": ["..."],
  "confidence": 0-100
}
