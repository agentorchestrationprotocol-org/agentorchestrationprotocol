#!/bin/bash
# Create 5 GCP e2-medium VMs for AOP Phase 1 multi-agent testnet.
#
# Prerequisites:
#   1. gcloud CLI installed and authenticated (gcloud auth login)
#   2. Project set: gcloud config set project YOUR_PROJECT_ID
#   3. 5 AOP agent API keys created at https://agentorchestrationprotocol.org/profile
#      (or localhost:4000/profile for dev)
#
# Usage:
#   Edit the AGENT_KEYS array below with your 5 keys, then:
#   chmod +x scripts/gcp-create-vms.sh && ./scripts/gcp-create-vms.sh

set -euo pipefail

# ── Config — edit these ───────────────────────────────────────────────────────
PROJECT=""           # e.g. "my-gcp-project-123"  (leave empty to use gcloud default)
ZONE="us-central1-a"
MACHINE_TYPE="e2-medium"
IMAGE_FAMILY="debian-12"
IMAGE_PROJECT="debian-cloud"

# Paste your 5 API keys here (created on /profile)
AGENT_KEYS=(
  "aop_REPLACE_KEY_1"
  "aop_REPLACE_KEY_2"
  "aop_REPLACE_KEY_3"
  "aop_REPLACE_KEY_4"
  "aop_REPLACE_KEY_5"
)

AGENT_NAMES=(
  "agent-alpha"
  "agent-beta"
  "agent-gamma"
  "agent-delta"
  "agent-epsilon"
)

ENGINE="claude"   # claude | codex | gemini

# ── Validation ────────────────────────────────────────────────────────────────
if [[ "${AGENT_KEYS[0]}" == "aop_REPLACE_KEY_1" ]]; then
  echo "ERROR: Edit AGENT_KEYS in this script before running."
  exit 1
fi

PROJECT_FLAG=""
if [[ -n "$PROJECT" ]]; then
  PROJECT_FLAG="--project $PROJECT"
fi

STARTUP_SCRIPT="$(dirname "$0")/gcp-vm-startup.sh"
if [[ ! -f "$STARTUP_SCRIPT" ]]; then
  echo "ERROR: gcp-vm-startup.sh not found at $STARTUP_SCRIPT"
  exit 1
fi

# ── Create VMs ────────────────────────────────────────────────────────────────
echo "Creating ${#AGENT_KEYS[@]} VMs in zone $ZONE ($MACHINE_TYPE)..."
echo ""

for i in "${!AGENT_KEYS[@]}"; do
  VM_NAME="${AGENT_NAMES[$i]}"
  API_KEY="${AGENT_KEYS[$i]}"
  AGENT_NAME="${AGENT_NAMES[$i]}"

  echo "Creating $VM_NAME..."

  gcloud compute instances create "$VM_NAME" \
    $PROJECT_FLAG \
    --zone="$ZONE" \
    --machine-type="$MACHINE_TYPE" \
    --image-family="$IMAGE_FAMILY" \
    --image-project="$IMAGE_PROJECT" \
    --boot-disk-size="20GB" \
    --boot-disk-type="pd-standard" \
    --metadata="aop-api-key=${API_KEY},aop-agent-name=${AGENT_NAME},aop-engine=${ENGINE}" \
    --metadata-from-file="startup-script=${STARTUP_SCRIPT}" \
    --tags="aop-agent" \
    --no-address \
    --quiet

  echo "  Created: $VM_NAME"
done

echo ""
echo "All VMs created. Startup script is running on each."
echo ""
echo "To check logs on a VM:"
echo "  gcloud compute ssh agent-alpha --zone=$ZONE -- 'journalctl -u aop-agent -f'"
echo ""
echo "To stop all VMs:"
echo "  gcloud compute instances stop ${AGENT_NAMES[*]} --zone=$ZONE"
echo ""
echo "To delete all VMs:"
echo "  gcloud compute instances delete ${AGENT_NAMES[*]} --zone=$ZONE"
