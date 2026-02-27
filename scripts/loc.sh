#!/usr/bin/env bash
# ── AOP Lines of Code Counter ───────────────────────────────────
# Counts production source lines, excluding blanks and comments.
# Usage: bash scripts/loc.sh [path]

set -euo pipefail

ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
ROOT="$(cd "$ROOT" && pwd)"
PROJECT_NAME="$(basename "$ROOT")"

# What to count
EXTENSIONS=( ts tsx js jsx mjs css )

# What to skip
EXCLUDE_DIRS=(
  node_modules
  .next
  artifacts
  dist
  coverage
  .git
)

# Build find args
FIND_NAMES=()
for ext in "${EXTENSIONS[@]}"; do
  [[ ${#FIND_NAMES[@]} -gt 0 ]] && FIND_NAMES+=( -o )
  FIND_NAMES+=( -name "*.${ext}" )
done

FIND_PRUNE=()
for dir in "${EXCLUDE_DIRS[@]}"; do
  FIND_PRUNE+=( -path "*/${dir}" -o )
done
# dummy true to close the -o chain
FIND_PRUNE+=( -false )

# ── Gather files ─────────────────────────────────────────────────
mapfile -t FILES < <(
  find "$ROOT" \
    \( "${FIND_PRUNE[@]}" \) -prune -o \
    -type f \( "${FIND_NAMES[@]}" \) -print \
  | sort
)

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No source files found."
  exit 0
fi

# ── Count ────────────────────────────────────────────────────────
# total   = all lines
# blank   = empty or whitespace-only
# code    = everything else (includes comments — good enough)

declare -A BY_EXT_FILES
declare -A BY_EXT_LINES
declare -A BY_DIR_FILES
declare -A BY_DIR_LINES
TOTAL_FILES=0
TOTAL_LINES=0
TOTAL_BLANK=0

for f in "${FILES[@]}"; do
  ext="${f##*.}"
  rel="${f#"$ROOT"/}"
  dir="${rel%%/*}"

  lines=$(wc -l < "$f")
  blank=$(grep -cE '^\s*$' "$f" || true)
  code=$((lines - blank))

  BY_EXT_FILES[$ext]=$(( ${BY_EXT_FILES[$ext]:-0} + 1 ))
  BY_EXT_LINES[$ext]=$(( ${BY_EXT_LINES[$ext]:-0} + code ))

  BY_DIR_FILES[$dir]=$(( ${BY_DIR_FILES[$dir]:-0} + 1 ))
  BY_DIR_LINES[$dir]=$(( ${BY_DIR_LINES[$dir]:-0} + code ))

  TOTAL_FILES=$((TOTAL_FILES + 1))
  TOTAL_LINES=$((TOTAL_LINES + code))
  TOTAL_BLANK=$((TOTAL_BLANK + blank))
done

# ── Output ───────────────────────────────────────────────────────
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

printf "\n"
printf "  ${BOLD}${CYAN}${PROJECT_NAME}${RESET}  ${DIM}Lines of Code${RESET}\n"
printf "  ${DIM}─────────────────────────────────────────${RESET}\n"

printf "\n  ${BOLD}By extension${RESET}\n"
printf "  ${DIM}%-8s %8s %8s${RESET}\n" "ext" "files" "code"
for ext in $(echo "${!BY_EXT_LINES[@]}" | tr ' ' '\n' | sort); do
  printf "  ${CYAN}%-8s${RESET} %8d %8d\n" ".$ext" "${BY_EXT_FILES[$ext]}" "${BY_EXT_LINES[$ext]}"
done

printf "\n  ${BOLD}By directory${RESET}\n"
printf "  ${DIM}%-20s %8s %8s${RESET}\n" "dir" "files" "code"
for dir in $(
  for d in "${!BY_DIR_LINES[@]}"; do
    echo "${BY_DIR_LINES[$d]} $d"
  done | sort -rn | awk '{print $2}'
); do
  printf "  ${YELLOW}%-20s${RESET} %8d %8d\n" "$dir/" "${BY_DIR_FILES[$dir]}" "${BY_DIR_LINES[$dir]}"
done

printf "\n  ${DIM}─────────────────────────────────────────${RESET}\n"
printf "  ${BOLD}${GREEN}Total${RESET}  %d files  ${BOLD}${GREEN}%s${RESET} lines of code  ${DIM}(%d blank lines excluded)${RESET}\n" \
  "$TOTAL_FILES" "$(printf '%d' $TOTAL_LINES)" "$TOTAL_BLANK"
printf "\n"
