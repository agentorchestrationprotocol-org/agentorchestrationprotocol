# Before Making This Repo Public

## 1. Rotate ALL exposed secrets

The following API key is baked into git history (commits `59970fb`, `8083aea`) and **must be revoked immediately** before the repo goes public. Anyone who clones the repo can run `git log -p` and see it.

```
agent_64a0e823e2bde22e07120f7566575c42a2e93d5d986ec5a6
```

Previous keys also in history (commit `59970fb`):
```
agent_6d07efe0e745fa7d4c6e6eaa1d8b2003f70a64ef3281ba1a
agent_c12c43dc15f7e6ee0a561986090a97011096a0558810b094
agent_937e273723c457665655f990d616a67a83d3b4779a56a056
agent_55353a6a9f87cc02217029ff7b28a95a41b53bf05970cb09
agent_2b30b44888972c5f2c653c903e6bf31ef81694d4c60ffbcc
```

**Action:** Go to your AOP admin panel, revoke every key above, and generate new ones. Set the new key as `AOP_AGENT_API_KEY` env var on your deploy server.

## 2. Scrub git history (optional but recommended)

Even after rotating, the old keys stay visible in history forever. To remove them:

```bash
# Install BFG Repo-Cleaner (https://rtyley.github.io/bfg-repo-cleaner/)
# Create a file with the secrets to remove:
cat > secrets.txt <<'EOF'
agent_64a0e823e2bde22e07120f7566575c42a2e93d5d986ec5a6
agent_6d07efe0e745fa7d4c6e6eaa1d8b2003f70a64ef3281ba1a
agent_c12c43dc15f7e6ee0a561986090a97011096a0558810b094
agent_937e273723c457665655f990d616a67a83d3b4779a56a056
agent_55353a6a9f87cc02217029ff7b28a95a41b53bf05970cb09
agent_2b30b44888972c5f2c653c903e6bf31ef81694d4c60ffbcc
EOF

bfg --replace-text secrets.txt
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force
```

If you skip this step, **rotating the keys (step 1) is still enough** to prevent unauthorized access. The old keys just remain visible as dead strings.

## 3. Set env vars on deploy server

`swarm/run_agent.sh` now reads from environment variables instead of hardcoded values. Set these wherever your agents run:

```bash
export AOP_BASE_URL="https://your-convex-site-url.convex.site"
export AOP_AGENT_API_KEY="your_new_rotated_key"
```

## 4. Delete this file

Once you've done all the above, delete this file and push.

```bash
rm DOTHISBEFOREPUTINGOPENSOURCE.md
```
