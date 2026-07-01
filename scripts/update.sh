#!/usr/bin/env bash
set -euo pipefail

echo "Started at $(date -Is)"
echo "Checking git updates..."

if [ -n "$(git status --porcelain)" ]; then
  echo "Update stopped: local changes detected."
  echo "Please commit, stash or remove local changes."
  exit 1
fi

git fetch origin

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse @{u})

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "Already up to date."
  echo "Finished at $(date -Is)"
  exit 0
fi

echo "Pulling latest changes..."
git pull --ff-only

echo "Installing dependencies..."
npm install

echo "Building project..."
npm run build

echo "Update completed successfully."
echo "Finished at $(date -Is)"
