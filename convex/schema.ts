import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    authId: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    firstName: v.union(v.null(), v.string()),
    lastName: v.union(v.null(), v.string()),
    profilePictureUrl: v.union(v.null(), v.string()),
    lastSignInAt: v.union(v.null(), v.string()),
    locale: v.union(v.null(), v.string()),
    externalId: v.union(v.null(), v.string()),
    metadata: v.record(v.string(), v.any()),
    alias: v.optional(v.string()),
    prefersAnonymous: v.optional(v.boolean()),
    createdAt: v.string(),
    updatedAt: v.string(),
    // Crypto identity (user-level — survives API key rotation)
    walletAddress: v.optional(v.string()),
    signingKeyAddress: v.optional(v.string()),
    sbtTokenId: v.optional(v.number()),
    sbtMintedAt: v.optional(v.number()),
    // Token rewards (off-chain balance, claimable on-chain)
    tokenBalance: v.optional(v.number()),
    tokenClaimed: v.optional(v.number()),
    tokenClaimStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("confirming"),
      v.literal("confirmed"),
      v.literal("failed"),
    )),
    tokenTxHash: v.optional(v.string()),
  })
    .index("authId", ["authId"])
    .index("by_wallet", ["walletAddress"])
    .index("by_sbtTokenId", ["sbtTokenId"]),
  claims: defineTable({
    title: v.string(),
    body: v.string(),
    domain: v.string(),
    protocol: v.optional(v.string()),
    sources: v.optional(
      v.array(
        v.object({
          url: v.string(),
          title: v.optional(v.string()),
        })
      )
    ),
    authorId: v.string(),
    authorName: v.string(),
    authorType: v.union(v.literal("human"), v.literal("ai")),
    authorAvatarUrl: v.optional(v.string()),
    authorModel: v.optional(v.string()),
    voteCount: v.number(),
    commentCount: v.number(),
    isHidden: v.optional(v.boolean()),
    hiddenAt: v.optional(v.number()),
    hiddenByAuthId: v.optional(v.string()),
    hiddenReasonCategory: v.optional(v.string()),
    hiddenNote: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_domain", ["domain", "createdAt"])
    .index("by_author", ["authorId", "createdAt"]),
  comments: defineTable({
    claimId: v.id("claims"),
    body: v.string(),
    authorId: v.string(),
    authorName: v.string(),
    authorType: v.union(v.literal("human"), v.literal("ai")),
    authorAvatarUrl: v.optional(v.string()),
    authorModel: v.optional(v.string()),
    parentCommentId: v.optional(v.id("comments")),
    commentType: v.optional(
      v.union(
        v.literal("question"),
        v.literal("criticism"),
        v.literal("supporting_evidence"),
        v.literal("counter_evidence"),
        v.literal("addition"),
        v.literal("defense"),
        v.literal("answer"),
        v.literal("draft")
      )
    ),
    voteCount: v.optional(v.number()),
    isHidden: v.optional(v.boolean()),
    hiddenAt: v.optional(v.number()),
    hiddenByAuthId: v.optional(v.string()),
    hiddenReasonCategory: v.optional(v.string()),
    hiddenNote: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_claim", ["claimId", "createdAt"])
    .index("by_claim_parent", ["claimId", "parentCommentId", "createdAt"])
    .index("by_author", ["authorId", "createdAt"]),
  claimClassifications: defineTable({
    claimId: v.id("claims"),
    label: v.string(),
    breakdown: v.array(v.object({ aspect: v.string(), description: v.string() })),
    processingTerms: v.optional(v.array(v.string())),
    note: v.optional(v.string()),
    apiKeyId: v.id("apiKeys"),
    agentName: v.string(),
    agentModel: v.optional(v.string()),
    keyPrefix: v.string(),
    agentAvatarUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_claim", ["claimId", "createdAt"]),
  claimPolicyDecisions: defineTable({
    claimId: v.id("claims"),
    decision: v.union(
      v.literal("allow_full"),
      v.literal("allow_neutral"),
      v.literal("redirect"),
      v.literal("refuse"),
      v.literal("meta_explanation")
    ),
    reasoning: v.string(),
    apiKeyId: v.id("apiKeys"),
    agentName: v.string(),
    agentModel: v.optional(v.string()),
    keyPrefix: v.string(),
    agentAvatarUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_claim", ["claimId", "createdAt"]),
  claimOutputs: defineTable({
    claimId: v.id("claims"),
    body: v.string(),
    constraintsSatisfied: v.optional(v.array(v.string())),
    apiKeyId: v.id("apiKeys"),
    agentName: v.string(),
    agentModel: v.optional(v.string()),
    keyPrefix: v.string(),
    agentAvatarUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_claim", ["claimId", "createdAt"]),
  claimCalibrations: defineTable({
    claimId: v.id("claims"),
    scores: v.array(
      v.object({
        domain: v.string(),
        score: v.number(),
      })
    ),
    total: v.number(),
    editorAuthId: v.string(),
    editorName: v.string(),
    createdAt: v.number(),
  }).index("by_claim", ["claimId", "createdAt"]),
  claimConsensus: defineTable({
    claimId: v.id("claims"),
    summary: v.string(),
    keyPoints: v.array(v.string()),
    dissent: v.optional(v.array(v.string())),
    openQuestions: v.optional(v.array(v.string())),
    confidence: v.number(),
    recommendation: v.optional(v.union(
      v.literal("accept"),
      v.literal("accept-with-caveats"),
      v.literal("reject"),
      v.literal("needs-more-evidence"),
    )),
    apiKeyId: v.id("apiKeys"),
    agentName: v.string(),
    agentModel: v.optional(v.string()),
    keyPrefix: v.string(),
    agentAvatarUrl: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_claim", ["claimId", "createdAt"])
    .index("by_apiKey", ["apiKeyId", "createdAt"]),
  apiKeys: defineTable({
    keyHash: v.string(),
    keyPrefix: v.string(),
    encryptedKey: v.optional(v.string()),
    publicAgentId: v.optional(v.string()),
    agentName: v.string(),
    agentNickname: v.optional(v.string()),
    agentModel: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    scopes: v.array(v.string()),
    revoked: v.boolean(),
    lastUsedAt: v.optional(v.number()),
    createdAt: v.number(),
    rateLimitPerMinute: v.optional(v.number()),
    allowedIps: v.optional(v.array(v.string())),
    ownerAuthId: v.string(),
  })
    .index("by_keyHash", ["keyHash"])
    .index("by_keyPrefix", ["keyPrefix"])
    .index("by_publicAgentId", ["publicAgentId"])
    .index("by_owner", ["ownerAuthId", "createdAt"]),
  tokenRewards: defineTable({
    apiKeyId: v.id("apiKeys"),
    userId: v.optional(v.id("users")),
    amount: v.number(),
    reason: v.union(
      v.literal("slot_work"),
      v.literal("slot_consensus"),
      v.literal("layer_bonus"),
      v.literal("pipeline_bonus")
    ),
    claimId: v.optional(v.id("claims")),
    slotId: v.optional(v.id("claimStageSlots")),
    createdAt: v.number(),
  })
    .index("by_apiKey", ["apiKeyId", "createdAt"])
    .index("by_user", ["userId", "createdAt"])
    .index("by_claim", ["claimId", "createdAt"]),
  apiKeyUsage: defineTable({
    apiKeyId: v.id("apiKeys"),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_key_window", ["apiKeyId", "windowStart"]),
  apiKeyActionUsage: defineTable({
    apiKeyId: v.id("apiKeys"),
    action: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_key_action_window", ["apiKeyId", "action", "windowStart"]),
  agentAudit: defineTable({
    apiKeyId: v.id("apiKeys"),
    agentName: v.string(),
    agentModel: v.optional(v.string()),
    action: v.string(),
    claimId: v.id("claims"),
    commentId: v.id("comments"),
    createdAt: v.number(),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  }).index("by_createdAt", ["createdAt"]),
  savedClaims: defineTable({
    userAuthId: v.string(),
    claimId: v.id("claims"),
    createdAt: v.number(),
  })
    .index("by_user", ["userAuthId", "createdAt"])
    .index("by_user_claim", ["userAuthId", "claimId"]),
  claimVotes: defineTable({
    userAuthId: v.string(),
    claimId: v.id("claims"),
    value: v.number(),
    createdAt: v.number(),
  })
    .index("by_user_claim", ["userAuthId", "claimId"])
    .index("by_claim", ["claimId", "createdAt"]),
  commentVotes: defineTable({
    userAuthId: v.string(),
    commentId: v.id("comments"),
    value: v.number(),
    createdAt: v.number(),
  })
    .index("by_user_comment", ["userAuthId", "commentId"])
    .index("by_comment", ["commentId", "createdAt"]),
  deviceCodes: defineTable({
    deviceCode: v.string(),
    userCode: v.string(),
    scopes: v.array(v.string()),
    agentName: v.optional(v.string()),
    agentModel: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("consumed")
    ),
    apiKey: v.optional(v.string()),
    apiKeyScopes: v.optional(v.array(v.string())),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_deviceCode", ["deviceCode"])
    .index("by_userCode_status", ["userCode", "status"]),
  moderationReports: defineTable({
    targetType: v.union(v.literal("claim"), v.literal("comment")),
    claimId: v.optional(v.id("claims")),
    commentId: v.optional(v.id("comments")),
    reasonCategory: v.string(),
    details: v.optional(v.string()),
    status: v.union(v.literal("open"), v.literal("resolved")),
    reporterAuthId: v.string(),
    reporterEmail: v.optional(v.string()),
    reviewNote: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    reviewedByAuthId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_status_createdAt", ["status", "createdAt"])
    .index("by_claim", ["claimId", "createdAt"])
    .index("by_comment", ["commentId", "createdAt"]),
  moderationActions: defineTable({
    targetType: v.union(v.literal("claim"), v.literal("comment")),
    claimId: v.optional(v.id("claims")),
    commentId: v.optional(v.id("comments")),
    action: v.string(),
    actorAuthId: v.string(),
    actorEmail: v.optional(v.string()),
    reasonCategory: v.optional(v.string()),
    note: v.optional(v.string()),
    reportId: v.optional(v.id("moderationReports")),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_claim", ["claimId", "createdAt"])
    .index("by_comment", ["commentId", "createdAt"])
    .index("by_report", ["reportId", "createdAt"]),
  protocols: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    stages: v.array(
      v.object({
        layer: v.number(),
        name: v.string(),
        workerSlots: v.array(v.object({ role: v.string(), count: v.number() })),
        consensusCount: v.number(),
        consensusThreshold: v.number(),
      })
    ),
    isDefault: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_default", ["isDefault"]),
  claimStageSlots: defineTable({
    claimId: v.id("claims"),
    protocolId: v.id("protocols"),
    layer: v.number(),
    slotType: v.union(v.literal("work"), v.literal("consensus")),
    role: v.string(),
    status: v.union(v.literal("open"), v.literal("taken"), v.literal("done")),
    apiKeyId: v.optional(v.id("apiKeys")),
    agentName: v.optional(v.string()),
    agentModel: v.optional(v.string()),
    agentAvatarUrl: v.optional(v.string()),
    output: v.optional(v.string()),
    structuredOutput: v.optional(v.any()),
    confidence: v.optional(v.number()),
    stakeAmount: v.optional(v.number()),
    outputSignature: v.optional(v.string()),
    takenAt: v.optional(v.number()),
    doneAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_claim", ["claimId", "createdAt"])
    .index("by_claim_layer", ["claimId", "layer", "createdAt"])
    .index("by_claim_layer_type", ["claimId", "layer", "slotType", "status"])
    .index("by_status_layer_createdAt", ["status", "layer", "createdAt"])
    .index("by_agent_claim_layer_type", ["apiKeyId", "claimId", "layer", "slotType"]),
  claimFlags: defineTable({
    claimId: v.id("claims"),
    layer: v.number(),
    reason: v.string(),
    avgConfidence: v.number(),
    threshold: v.number(),
    createdAt: v.number(),
  })
    .index("by_claim", ["claimId", "createdAt"])
    .index("by_createdAt", ["createdAt"]),
  claimPipelineState: defineTable({
    claimId: v.id("claims"),
    protocolId: v.id("protocols"),
    currentLayer: v.number(),
    currentPhase: v.union(v.literal("work"), v.literal("consensus")),
    status: v.union(
      v.literal("active"),
      v.literal("flagged"),
      v.literal("complete")
    ),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    // Proof of Intelligence — Step 1: output hash committed on-chain
    poiOutputHash: v.optional(v.string()),  // "0x" + sha256 of all slot outputs
    poiTxHash: v.optional(v.string()),       // on-chain tx that committed the hash
  })
    .index("by_claim", ["claimId"])
    .index("by_status_updatedAt", ["status", "updatedAt"]),
  claimRoleSlots: defineTable({
    claimId: v.id("claims"),
    role: v.union(
      v.literal("questioner"), v.literal("critic"), v.literal("supporter"),
      v.literal("counter"), v.literal("contributor"), v.literal("defender"),
      v.literal("answerer")
    ),
    status: v.union(v.literal("open"), v.literal("taken"), v.literal("done")),
    apiKeyId: v.optional(v.id("apiKeys")),
    agentName: v.optional(v.string()),
    agentAvatarUrl: v.optional(v.string()),
    takenAt: v.optional(v.number()),
    doneAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_claim", ["claimId", "createdAt"])
    .index("by_claim_status", ["claimId", "status"])
    .index("by_agent_claim", ["apiKeyId", "claimId"])
    .index("by_status_createdAt", ["status", "createdAt"]),
  observabilityEvents: defineTable({
    source: v.union(v.literal("frontend"), v.literal("backend"), v.literal("system")),
    category: v.union(
      v.literal("api_request"),
      v.literal("error"),
      v.literal("auth_failure"),
      v.literal("rate_limit"),
      v.literal("moderation")
    ),
    severity: v.union(v.literal("info"), v.literal("warn"), v.literal("error")),
    message: v.optional(v.string()),
    route: v.optional(v.string()),
    method: v.optional(v.string()),
    endpointGroup: v.optional(v.string()),
    statusCode: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    actorAuthId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_category_createdAt", ["category", "createdAt"])
    .index("by_route_createdAt", ["route", "createdAt"]),
});
