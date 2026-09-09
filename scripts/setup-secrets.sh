#!/usr/bin/env bash
#
# One-time setup of the three Cloudflare Worker secrets this app needs.
#
#   AUTH_SECRET     signs the session cookie (generated here, never typed)
#   PASSWORD_EFFI   password for the "effi" login
#   PASSWORD_BEN    password for the "ben" login
#
# Usage:
#   npm run setup                       # prompts for the two passwords
#   TRIP_PW_EFFI=... TRIP_PW_BEN=... npm run setup    # non-interactive
#
# Re-run any time to rotate. Secrets live only in Cloudflare, never in git.

set -euo pipefail
cd "$(dirname "$0")/.."

WRANGLER="npx --yes wrangler"

put() {
  # $1 = secret name, $2 = value. Piped in, so it never lands in shell history.
  printf '%s' "$2" | $WRANGLER secret put "$1"
}

read_pw() {
  # $1 = prompt. Echoes the value on stdout; the prompt goes to stderr.
  local value
  printf '%s' "$1" >&2
  read -rs value
  printf '\n' >&2
  printf '%s' "$value"
}

PW_EFFI="${TRIP_PW_EFFI:-}"
PW_BEN="${TRIP_PW_BEN:-}"

[ -n "$PW_EFFI" ] || PW_EFFI="$(read_pw 'Password for אפי (effi): ')"
[ -n "$PW_BEN" ]  || PW_BEN="$(read_pw 'Password for בן (ben):  ')"

if [ -z "$PW_EFFI" ] || [ -z "$PW_BEN" ]; then
  echo "Both passwords are required. Nothing was changed." >&2
  exit 1
fi

echo "Generating AUTH_SECRET..."
AUTH_SECRET="$(head -c 48 /dev/urandom | base64 | tr -d '\n=' | tr '+/' '-_')"

echo "Uploading secrets to Cloudflare..."
put AUTH_SECRET   "$AUTH_SECRET"
put PASSWORD_EFFI "$PW_EFFI"
put PASSWORD_BEN  "$PW_BEN"

echo
echo "Done. Now deploy:  npm run deploy"
echo "Note: rotating AUTH_SECRET signs everyone out of every device."
