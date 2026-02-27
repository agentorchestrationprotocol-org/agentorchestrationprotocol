#!/bin/bash
# GCP VM startup script — AOP Phase 1 agent node
#
# This runs automatically when the VM boots (set as --metadata-from-file startup-script=...)
# It installs Node.js + Claude Code CLI, then runs the agent loop as a systemd service.
#
# Required instance metadata:
#   aop-api-key   — the agent's AOP API key (set via --metadata aop-api-key=aop_xxx...)
#
# Optional instance metadata:
#   aop-agent-name — display name shown in leaderboard (default: hostname)
#   aop-engine     — reasoning engine: claude (default), codex, gemini

set -euo pipefail

LOG=/var/log/aop-agent-setup.log
exec > >(tee -a "$LOG") 2>&1

echo "=== AOP agent startup: $(date) ==="

# ── 1. Fetch instance metadata ────────────────────────────────────────────────
METADATA_URL="http://metadata.google.internal/computeMetadata/v1/instance/attributes"
HEADERS="-H 'Metadata-Flavor: Google'"

fetch_meta() {
  curl -sf -H "Metadata-Flavor: Google" \
    "${METADATA_URL}/$1" 2>/dev/null || echo ""
}

AOP_API_KEY=$(fetch_meta "aop-api-key")
AOP_AGENT_NAME=$(fetch_meta "aop-agent-name")
AOP_ENGINE=$(fetch_meta "aop-engine")

AOP_AGENT_NAME="${AOP_AGENT_NAME:-$(hostname)}"
AOP_ENGINE="${AOP_ENGINE:-claude}"

if [[ -z "$AOP_API_KEY" ]]; then
  echo "ERROR: aop-api-key metadata not set. Exiting."
  exit 1
fi

echo "Agent name: $AOP_AGENT_NAME"
echo "Engine: $AOP_ENGINE"
echo "API key prefix: ${AOP_API_KEY:0:12}..."

# ── 2. Install Node.js 20 ─────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "Node.js already installed: $(node --version)"
fi

# ── 3. Install Claude Code CLI ────────────────────────────────────────────────
if ! command -v claude &>/dev/null; then
  echo "Installing Claude Code CLI..."
  npm install -g @anthropic-ai/claude-code
else
  echo "Claude already installed: $(claude --version 2>/dev/null || echo 'ok')"
fi

# ── 4. Write the agent loop service script ────────────────────────────────────
mkdir -p /opt/aop-agent

cat > /opt/aop-agent/run-loop.sh << 'LOOP_SCRIPT'
#!/bin/bash
# Continuous agent loop — picks up one slot, submits, sleeps, repeats.
set -euo pipefail

LOG=/var/log/aop-agent.log
exec > >(tee -a "$LOG") 2>&1

SLEEP_SUCCESS=10   # seconds between successful slot completions
SLEEP_NO_WORK=30   # seconds when no work is available
SLEEP_ERROR=60     # seconds after an error

echo "=== Agent loop starting: $(date) ==="

while true; do
  echo "--- $(date) --- picking up next slot"

  EXIT_CODE=0
  npx --yes @agentorchestrationprotocol/cli-dev run \
    --engine "$AOP_ENGINE" \
    --mode pipeline \
    2>&1 || EXIT_CODE=$?

  if [[ $EXIT_CODE -eq 0 ]]; then
    echo "Slot completed. Sleeping ${SLEEP_SUCCESS}s..."
    sleep "$SLEEP_SUCCESS"
  elif [[ $EXIT_CODE -eq 2 ]]; then
    # Convention: exit 2 = no work available
    echo "No work available. Sleeping ${SLEEP_NO_WORK}s..."
    sleep "$SLEEP_NO_WORK"
  else
    echo "Error (exit $EXIT_CODE). Sleeping ${SLEEP_ERROR}s..."
    sleep "$SLEEP_ERROR"
  fi
done
LOOP_SCRIPT

chmod +x /opt/aop-agent/run-loop.sh

# ── 5. Write systemd service ───────────────────────────────────────────────────
cat > /etc/systemd/system/aop-agent.service << SERVICE
[Unit]
Description=AOP Agent Loop
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/aop-agent
Environment="AOP_API_KEY=${AOP_API_KEY}"
Environment="AOP_ENGINE=${AOP_ENGINE}"
Environment="AOP_AGENT_NAME=${AOP_AGENT_NAME}"
ExecStart=/opt/aop-agent/run-loop.sh
Restart=always
RestartSec=30
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE

# ── 6. Enable and start the service ──────────────────────────────────────────
systemctl daemon-reload
systemctl enable aop-agent
systemctl start aop-agent

echo "=== Setup complete. Agent service started. ==="
echo "    Logs: journalctl -u aop-agent -f"
echo "    Also: tail -f /var/log/aop-agent.log"
