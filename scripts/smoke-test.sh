#!/usr/bin/env bash
#
# Post-deploy check of the auth boundary. Run it against the live Worker
# after `npm run deploy`, or against `npm run dev` on localhost.
#
# Usage:
#   TRIP_PW_EFFI=... bash scripts/smoke-test.sh https://latrip.<subdomain>.workers.dev
#
# Without TRIP_PW_EFFI the positive-path checks are skipped and only the
# "everything is locked" checks run, which is still the important half.

set -uo pipefail

BASE="${1:-http://127.0.0.1:8787}"
BASE="${BASE%/}"
JAR="$(mktemp)"
BODY="$(mktemp)"
trap 'rm -f "$JAR" "$BODY"' EXIT

pass=0; fail=0
chk() {
  if [ "$2" = "$3" ]; then
    printf '  PASS  %s\n' "$1"; pass=$((pass + 1))
  else
    printf '  FAIL  %s (got %s, want %s)\n' "$1" "$2" "$3"; fail=$((fail + 1))
  fi
}

login_code() {
  curl -sS -o /dev/null -w '%{http_code}' \
    -X POST "$BASE/api/login" \
    -H 'Content-Type: application/json' \
    -d "{\"user\":\"$1\",\"password\":\"$2\"}"
}

echo "Checking $BASE"

echo "== locked by default =="
code=$(curl -sS -o "$BODY" -w '%{http_code}' "$BASE/")
chk "GET / responds" "$code" "200"
grep -q 'id="password"' "$BODY" && r=login || r=app
chk "anonymous visitor gets the login page" "$r" "login"
grep -q 'id="t_work_effi"' "$BODY" && r=leaked || r=clean
chk "no trip content served to anonymous visitor" "$r" "clean"

echo "== credentials are actually checked =="
chk "wrong password rejected"  "$(login_code effi   definitely-not-it)" "401"
chk "unknown user rejected"    "$(login_code nobody x)"                 "401"
chk "empty password rejected"  "$(login_code effi   '')"                "401"
code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/api/login" \
  -H 'Content-Type: application/json' -d 'not-json')
chk "malformed body rejected" "$code" "400"
chk "GET /api/login not allowed" \
  "$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/api/login")" "405"

echo "== forged cookies are rejected =="
future=$(( $(date +%s) + 86400 ))
for cookie in "garbage" "effi.$future.notarealsignature" "effi.1000000000.x"; do
  curl -sS -o "$BODY" -H "Cookie: trip_session=$cookie" "$BASE/" >/dev/null
  grep -q 'id="password"' "$BODY" && r=login || r=app
  chk "cookie '${cookie:0:24}' rejected" "$r" "login"
done

if [ -n "${TRIP_PW_EFFI:-}" ]; then
  echo "== the real password works =="
  chk "correct password accepted" "$(curl -sS -c "$JAR" -o /dev/null -w '%{http_code}' \
    -X POST "$BASE/api/login" -H 'Content-Type: application/json' \
    -d "{\"user\":\"effi\",\"password\":$(printf '%s' "$TRIP_PW_EFFI" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')}")" "200"
  curl -sS -b "$JAR" -o "$BODY" "$BASE/" >/dev/null
  grep -q 'window.__TRIP_USER__ = "effi"' "$BODY" && r=yes || r=no
  chk "app served with the signed-in identity" "$r" "yes"
  grep -q '%%TRIP_USER%%' "$BODY" && r=leftover || r=clean
  chk "identity placeholder consumed" "$r" "clean"
  curl -sS -b "$JAR" -c "$JAR" -o /dev/null -X POST "$BASE/api/logout"
  curl -sS -b "$JAR" -o "$BODY" "$BASE/" >/dev/null
  grep -q 'id="password"' "$BODY" && r=login || r=app
  chk "logout ends the session" "$r" "login"
else
  echo "== skipping signed-in checks (set TRIP_PW_EFFI to include them) =="
fi

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
