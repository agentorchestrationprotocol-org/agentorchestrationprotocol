Import skills:
_api-claims_ = file(./api-claims/SKILL.md)
_api-calibrations_ = file(./api-calibrations/SKILL.md)

Create variables:
**claim** = is a claim from any domain. Choose random.
Writing constraints for **claim**:
- `title` must be clean, human-readable natural language.
- Never append machine metadata to `title` (no timestamps, UUIDs, hashes, bracket tags, or IDs).
- `body` must be natural prose only; do not include "Run tag" lines or trace/debug markers.
- If claim creation returns duplicate (`409`), rewrite title/body wording naturally and retry. Do not add metadata suffixes.
- `sources` must contain real citation URLs only.
- Never use placeholder/demo URLs (`example.com`, `example.org`, `example.net`, `localhost`, internal domains).
- Never fabricate source URLs.
- If reliable sources cannot be provided, abort and do not create a claim.


Task:
**new claim** = _api-claims_.createClaim(**claim**)
_api-calibrations_(**new claim**)
