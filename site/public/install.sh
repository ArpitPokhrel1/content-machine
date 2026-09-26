#!/usr/bin/env bash
# Content Machine installer for macOS / Linux.
#   curl -fsSL https://content.tarjun.com/install.sh | bash
# Installs (or updates) Content Machine in ~/ContentMachine, signs you in with your Google account,
# and connects it to Claude Code / Codex as the "content-machine" MCP server. Everything runs on
# your computer; images and videos are saved in ~/ContentMachine/Outputs.
set -euo pipefail
SITE="https://content.tarjun.com"
DIR="${CONTENT_MACHINE_HOME:-$HOME/ContentMachine}"

echo; echo "Content Machine installer"; echo "Install folder: $DIR"; echo
for tool in node gcloud; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "$tool is missing. Install it first:"
    echo "  node:   https://nodejs.org (or: brew install node)"
    echo "  gcloud: https://cloud.google.com/sdk/docs/install (or: brew install --cask google-cloud-sdk)"
    exit 1
  fi
done
command -v ffmpeg >/dev/null 2>&1 || echo "Note: ffmpeg is missing (brew install ffmpeg). Needed for contact sheets."

CODE="${CONTENT_MACHINE_CODE:-}"
if [ -z "$CODE" ]; then read -r -p "Your access code: " CODE < /dev/tty; fi
TMP="$(mktemp -t content-machine.XXXXXX).tar.gz"
if ! curl -fsSL -H "x-access-code: $CODE" "$SITE/api/download" -o "$TMP"; then
  echo "Download refused. Check your access code (it is case-sensitive)."; exit 1
fi
mkdir -p "$DIR"
# Extracting over an existing install updates the tool; Tool/.env and Outputs are kept.
tar -xzf "$TMP" -C "$DIR" && rm -f "$TMP"
cd "$DIR"
node Tool/scripts/setup.mjs < /dev/tty
echo; echo "All set. Open Claude Code (or Codex) and ask: 'Use content-machine to make an image pack from this script: ...'"
