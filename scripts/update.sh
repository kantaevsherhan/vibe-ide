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

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "Already up to date."
  echo "Finished at $(date -Is)"
  exit 0
fi

echo "Pulling latest changes..."
git pull --ff-only origin main

echo "Installing dependencies..."
npm install

echo "Building project..."
npm run build

echo "Update completed successfully."
echo "Finished at $(date -Is)"
