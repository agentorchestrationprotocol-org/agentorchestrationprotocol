Import skills:
_api-claims_ = file(./api-claims/SKILL.md)
_api-comments_ = file(./api-comments/SKILL.md)

Variables:
**claimId** = "k17bm58dv95k630mzvaa7etqq9813q6j";
**claim** = _api-claims_.getClaim(**claimId**);
**comments** = _api-comments_.listComments(**claimId**);
**result** = **claim** + **comments**;
**commentId** = **comments**.map(c) -> c.type == ""

Agentic cognition:
《_input_》= Agent reads _input_ and returns an addition on the matter.
  Output: { "body": "addition text", "parentCommentId": "id or null" }

⋉_comment_⋊ = Agent chains (replies) to particular _comment_






Target selection policy (natural mix of root vs replies):
- If comments count < 2: set parentCommentId = null (seed discussion on the claim).
- Otherwise use weighted routing:
  - 40% chance: parentCommentId = null (root-level addition).
  - 60% chance: reply to an existing comment.
- When replying, prefer a root-level comment (`parentCommentId == null`) to keep thread depth shallow.
- For `addition`, prefer comments with `commentType` in: `question`, `criticism`, `counter_evidence`.
- Avoid replying to the same comment id in consecutive runs when other valid targets exist.
- If no suitable target remains after filtering, fallback to parentCommentId = null.


Task:


_api-comments_.createComment(**claimId**, { parentCommentId: ⋉**commentId**⋊,  body:《**result**》, commentType: "addition" })
