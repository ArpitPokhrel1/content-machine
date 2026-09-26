#!/usr/bin/env bash
# Content Machine: first-time setup on macOS / Linux.   ./setup.sh [--maps]
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install Node 22 LTS (https://nodejs.org, or: brew install node), then re-run ./setup.sh"
  exit 1
fi
command -v ffmpeg >/dev/null 2>&1 || echo "Note: ffmpeg is missing (brew install ffmpeg / apt install ffmpeg). Needed for contact sheets and map renders."
command -v gcloud >/dev/null 2>&1 || echo "Note: gcloud is missing (https://cloud.google.com/sdk). Needed for Google Cloud login unless you use a Gemini API key."

node asset-generation/scripts/setup.mjs "$@"
