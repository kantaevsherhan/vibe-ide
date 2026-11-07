#!/usr/bin/env bash
set -euo pipefail

echo "Started at $(date -Is)"
echo "Checking git updates..."

LOCAL_CHANGES=$(git status --porcelain | grep -Ev '^[ MADRCU?!]{2}(\.vibeide/|logs/|data/|storage/|config/settings\.json|config/runtime\.json|config/agents\.config\.json)' || true)

if [ -n "$LOCAL_CHANGES" ]; then
  echo "Update stopped: local changes detected."
  echo "Please commit, stash or remove local changes."
  echo "$LOCAL_CHANGES"
  exit 1
fi

git fetch origin

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

PENDING_BUILD=.vibeide/system/pending-build

if [ "$LOCAL" = "$REMOTE" ] && [ ! -f "$PENDING_BUILD" ]; then
  echo "Already up to date."
  echo "Finished at $(date -Is)"
  exit 0
fi

mkdir -p .vibeide/system
printf "%s\n" "$REMOTE" > "$PENDING_BUILD"

echo "Pulling latest changes..."
git pull --ff-only origin main

echo "Installing dependencies..."
npm ci

echo "Building project..."
npm run build
rm -f "$PENDING_BUILD"

echo "Update completed successfully."
echo "Finished at $(date -Is)"
