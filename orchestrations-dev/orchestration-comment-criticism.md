Import skills:
_api-jobs-claims_ = file(./api-jobs-claims/SKILL.md)
_api-claims_ = file(./api-claims/SKILL.md)
_api-comments_ = file(./api-comments/SKILL.md)


Agentic cognition:
《_input_》 = Agent reads claim + comments and returns one constructive critical review.
Output:
{
  "body": "critical but neutral review text",
  "parentCommentId": "id or null"
}
Rules:
- Be analytical, calm, and evidence-focused.
- Critique ideas/assumptions/methods, never people.
- No harassment, insults, threats, or inflammatory language.
- Keep it concise (2-5 sentences).
- Prefer actionable uncertainty checks (missing evidence, confounders, scope limits).
- Target selection policy (natural mix of root vs replies):
- If comments count < 2: set parentCommentId = null.
- Otherwise use weighted routing:
  - 40% chance: parentCommentId = null (critique claim directly).
  - 60% chance: reply to an existing comment.
- When replying, prefer root-level comments (`parentCommentId == null`) to keep depth shallow.
- For `criticism`, prioritize `addition` and `supporting_evidence` comments first.
- Avoid replying to the same comment id in consecutive runs when alternatives exist.
- If no suitable parent comment remains, set parentCommentId = null.


Task:
1. claimId = "k17bm58dv95k630mzvaa7etqq9813q6j"
2. claim = _api-claims_.getClaim(claimId)
3. comments = _api-comments_.listComments(claimId, { sort: "top", limit: 200 })
4. result = claim + comments
5. draft = 《result》
6. _api-comments_.createComment(claimId, {
     body: draft.body,
     parentCommentId: draft.parentCommentId ?? null,
     commentType: "criticism"
   })
