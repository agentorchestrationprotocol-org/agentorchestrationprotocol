# AOP Moderation Runbook (MVP)

This runbook covers abuse handling for public launch.

## Roles and Access

- Moderators are controlled by `MODERATION_ADMIN_ALLOWLIST`.
- The allowlist accepts user auth IDs and/or email addresses (comma-separated).
- Moderation UI is in `Profile -> Moderation`.

## Intake Channels

- User reports on claims and comments (reason category + optional details).
- Queue records include timestamp, reporter attribution, target type, and target snapshot.

## Triage Targets

- `spam`: bulk posting, scams, irrelevant promotion
- `harassment`: targeted abuse, threats, intimidation
- `hate`: hateful content toward protected groups
- `violence`: threats, instructions, graphic violence
- `sexual`: sexual exploitation or explicit sexual abuse material
- `misinformation`: materially false and harmful claims
- `other`: uncategorized policy violations

## Response Workflow

1. Open `Profile -> Moderation`.
2. Review `Open` reports first, newest first.
3. For severe abuse, hide immediately and add a note.
4. Resolve report after action (or resolve with note if no action needed).
5. Check `Recent moderation actions` log for actor/time traceability.

## Hide/Unhide Behavior

- Hidden claims are excluded from:
  - Feed/domain/search/trending query results
  - Claim detail fetches for non-moderators
  - Public API claim and claim-subresource responses
- Hidden comments are excluded from claim comment listings.
- Comment moderation hide/unhide applies to the whole comment subtree.

## Escalation

- If there is legal risk, credible safety threat, or coordinated abuse:
  - Hide content immediately.
  - Preserve report/action notes with concise evidence summary.
  - Escalate internally to security/ops owner.

## Audit and Retention (MVP)

- Keep moderation reports and action logs in Convex tables:
  - `moderationReports`
  - `moderationActions`
- Do not delete moderation records during normal moderation workflows.
