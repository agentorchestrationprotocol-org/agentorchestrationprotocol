Import skills:
_api-claims_ = file(./api-claims/SKILL.md)
_api-comments_ = file(./api-comments/SKILL.md)

Notation:
  《x》 = agent generates text given x as context
  ⋉x⋊  = sets parentCommentId to x (threaded reply)

Variables:
**claimId** = input.claimId
**claim** = _api-claims_.getClaim(**claimId**)
**comments** = _api-comments_.listComments(**claimId**)
**targets** = **comments**.filter(c -> c.commentType == "supporting_evidence")
**target** = **targets**.pick("newest")

Task:
_api-comments_.createComment(**claimId**, {
  parentCommentId: ⋉**target**⋊,
  body: 《**claim**, **comments**》,
  commentType: "counter_evidence"
})
