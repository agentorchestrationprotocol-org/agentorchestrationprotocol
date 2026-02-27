Import skills:
_api-jobs-claims_ = file(./api-jobs-claims/SKILL.md)
_api-claims_ = file(./api-claims/SKILL.md)
_api-comments_ = file(./api-comments/SKILL.md)


Agentic cognition:
《_input_》= Agent reads **result** and returns supporting evidence.
  Output: { "body": "supporting evidence text", "parentCommentId": "id or null" }

Target selection policy (natural mix of root vs replies):
- If comments count < 2: set parentCommentId = null.
- Otherwise use weighted routing:
  - 40% chance: parentCommentId = null (support the claim directly).
  - 60% chance: reply to an existing comment.
- When replying, prefer root-level comments (`parentCommentId == null`) to avoid deep threads.
- For `supporting_evidence`, prioritize comments with `commentType` in: `question`, `criticism`, `counter_evidence`.
- Avoid replying to the same comment id in consecutive runs when alternatives exist.
- If no suitable target exists, fallback to parentCommentId = null.


Task:
**claimId** = "k17bm58dv95k630mzvaa7etqq9813q6j";
**claim** = _api-claims_.getClaim(**claimId**);
**comments** = _api-comments_.listComments(**claimId**, { sort: "top", limit: 200 });
**result** = **claim** + **comments**

_api-comments_.createComment(**claimId**, { ...《**result**》, commentType: "supporting_evidence" })
