#!/usr/bin/env bash
# SI-2: put each NEXT_ACTIONS_KEY_* GitHub secret into the app env file, so pods run with the key their image was built with.
# Usage: next-actions-keys.sh <app-env-file>   (reads NEXT_ACTIONS_KEY_* from the environment; edits the file in place)
set -euo pipefail

ENV_FILE=$1
for name in $(compgen -e | grep '^NEXT_ACTIONS_KEY_' | sort); do
  value=${!name}
  [ -n "$value" ] || { echo "  $name: no GitHub secret; that app keeps Next's per-build key."; continue; }
  existing=$(grep -m1 "^$name=" "$ENV_FILE" | cut -d= -f2- || true)
  if [ -n "$existing" ] && [ "$existing" != "$value" ]; then
    # Build and runtime must use the same key, or every server action in that app fails.
    echo "::error::$name differs between the GitHub secret (build) and the app secret bundle (runtime). Make them equal."
    exit 1
  fi
  [ -n "$existing" ] || printf '%s=%s\n' "$name" "$value" >> "$ENV_FILE"
  echo "  $name: set."
done
